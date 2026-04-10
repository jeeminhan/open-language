"""Microphone capture and audio playback."""

import threading
import numpy as np
import sounddevice as sd
import soundfile as sf

SAMPLE_RATE = 16000
CHANNELS = 1


def record_push_to_talk(silence_threshold: float = 0.01, silence_duration: float = 1.5,
                         max_duration: float = 60.0) -> str:
    """Record audio until silence is detected after speech. Returns path to WAV file.

    Press Enter to stop manually, or it auto-stops after silence_duration seconds of silence.
    """
    chunks: list[np.ndarray] = []
    is_recording = True
    speech_detected = False
    silent_frames = 0
    frames_per_chunk = int(SAMPLE_RATE * 0.1)  # 100ms chunks
    silence_chunks_needed = int(silence_duration / 0.1)

    stop_event = threading.Event()

    def audio_callback(indata, frames, time, status):
        nonlocal speech_detected, silent_frames
        if stop_event.is_set():
            raise sd.CallbackAbort()

        chunks.append(indata.copy())
        energy = np.sqrt(np.mean(indata ** 2))

        if energy > silence_threshold:
            speech_detected = True
            silent_frames = 0
        elif speech_detected:
            silent_frames += 1
            if silent_frames >= silence_chunks_needed:
                stop_event.set()
                raise sd.CallbackAbort()

    # Start recording
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS,
                        blocksize=frames_per_chunk, callback=audio_callback):
        # Wait for stop event or Enter key
        def wait_for_enter():
            input()
            stop_event.set()

        enter_thread = threading.Thread(target=wait_for_enter, daemon=True)
        enter_thread.start()

        stop_event.wait(timeout=max_duration)

    if not chunks:
        return ""

    audio_data = np.concatenate(chunks)
    output_path = "/tmp/voice_tutor_recording.wav"
    sf.write(output_path, audio_data, SAMPLE_RATE)
    return output_path


def play_audio(file_path: str) -> None:
    """Play a WAV file through speakers."""
    data, sr = sf.read(file_path)
    sd.play(data, sr)
    sd.wait()


def check_microphone() -> bool:
    """Check if a microphone is available."""
    try:
        devices = sd.query_devices()
        default_input = sd.query_devices(kind='input')
        return default_input is not None
    except Exception:
        return False
