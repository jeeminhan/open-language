const CAPTURE_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.ceil(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, input.length - 1);
    const frac = srcIndex - floor;
    output[i] = input[floor] * (1 - frac) + input[ceil] * frac;
  }
  return output;
}

function convertToPCM16(float32Array: Float32Array): ArrayBuffer {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff;
  }
  return int16Array.buffer;
}

export function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

export class AudioManager {
  captureContext: AudioContext | null = null;
  playbackContext: AudioContext | null = null;
  mediaStream: MediaStream | null = null;
  workletNode: AudioWorkletNode | null = null;
  sourceNode: MediaStreamAudioSourceNode | null = null;
  onAudioData: ((data: ArrayBuffer) => void) | null = null;
  onPlaybackStateChange: ((playing: boolean) => void) | null = null;
  nativeSampleRate = 48000;
  scheduledPlaybackTime = 0;
  activePlaybackSources: Set<AudioBufferSourceNode> = new Set();
  private wasPlaying = false;
  private playbackEndTimer: ReturnType<typeof setTimeout> | null = null;

  async startCapture(onData: (data: ArrayBuffer) => void) {
    this.onAudioData = onData;

    if (!this.captureContext) {
      this.captureContext = new AudioContext();
    }
    if (this.captureContext.state === "suspended") {
      await this.captureContext.resume();
    }

    this.nativeSampleRate = this.captureContext.sampleRate;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    await this.captureContext.audioWorklet.addModule("/capture.worklet.js");

    this.workletNode = new AudioWorkletNode(
      this.captureContext,
      "audio-capture-processor"
    );
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (!this.onAudioData || event.data.type !== "audio") return;
      const resampled = resampleLinear(
        event.data.data,
        this.nativeSampleRate,
        CAPTURE_SAMPLE_RATE
      );
      this.onAudioData(convertToPCM16(resampled));
    };

    this.sourceNode = this.captureContext.createMediaStreamSource(
      this.mediaStream
    );
    this.sourceNode.connect(this.workletNode);
  }

  stopCapture() {
    this.onAudioData = null;
    if (this.workletNode) {
      this.workletNode.port.close();
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  playAudio(pcmData: ArrayBuffer) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext();
    }

    const int16Samples = new Int16Array(pcmData);
    const float32Samples = int16ToFloat32(int16Samples);
    const audioBuffer = this.playbackContext.createBuffer(
      1,
      float32Samples.length,
      PLAYBACK_SAMPLE_RATE
    );
    audioBuffer.getChannelData(0).set(float32Samples);
    this.schedulePlayback(audioBuffer);
  }

  private schedulePlayback(buffer: AudioBuffer) {
    if (!this.playbackContext) return;
    if (this.playbackContext.state === "suspended") {
      this.playbackContext.resume().then(() => this.schedulePlayback(buffer));
      return;
    }

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;

    const now = this.playbackContext.currentTime;
    const startTime = Math.max(now, this.scheduledPlaybackTime);

    source.connect(this.playbackContext.destination);
    this.activePlaybackSources.add(source);

    // Signal playback started (only once per playback burst)
    if (!this.wasPlaying) {
      this.wasPlaying = true;
      if (this.playbackEndTimer) { clearTimeout(this.playbackEndTimer); this.playbackEndTimer = null; }
      this.onPlaybackStateChange?.(true);
    }
    // Cancel any pending "ended" signal since new audio arrived
    if (this.playbackEndTimer) { clearTimeout(this.playbackEndTimer); this.playbackEndTimer = null; }

    source.onended = () => {
      this.activePlaybackSources.delete(source);
      source.disconnect();
      if (this.activePlaybackSources.size === 0 && this.wasPlaying) {
        // Debounce: wait 500ms before signaling playback ended
        // (new chunks may arrive in the gap between sources)
        if (this.playbackEndTimer) clearTimeout(this.playbackEndTimer);
        this.playbackEndTimer = setTimeout(() => {
          if (this.activePlaybackSources.size === 0 && this.wasPlaying) {
            this.wasPlaying = false;
            this.onPlaybackStateChange?.(false);
          }
        }, 500);
      }
    };
    source.start(startTime);
    this.scheduledPlaybackTime = startTime + buffer.duration;
  }

  /** Ensure the capture context is running — call after model turn ends */
  async ensureCaptureActive() {
    if (this.captureContext && this.captureContext.state === "suspended") {
      await this.captureContext.resume();
    }
    // Re-check the media stream is still active
    if (this.mediaStream) {
      const track = this.mediaStream.getAudioTracks()[0];
      if (track && !track.enabled) {
        track.enabled = true;
      }
    }
  }

  stopPlayback() {
    this.scheduledPlaybackTime = 0;
    this.wasPlaying = false;
    if (this.playbackEndTimer) { clearTimeout(this.playbackEndTimer); this.playbackEndTimer = null; }
    for (const source of this.activePlaybackSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activePlaybackSources.clear();
    // Resume capture after stopping playback to ensure mic is active
    this.ensureCaptureActive();
  }

  destroy() {
    this.stopCapture();
    this.stopPlayback();
    if (this.captureContext) {
      this.captureContext.close();
      this.captureContext = null;
    }
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }
  }
}
