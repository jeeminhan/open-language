"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Play a classic dual-tone ringback during the "ringing" phase of a call.
 * Uses WebAudio oscillators so we don't need to ship an audio asset.
 *
 * Returns a setter: `setRinging(true)` to start, `setRinging(false)` to stop.
 * The setter is idempotent — calling it twice in a row with the same value
 * is a no-op.
 *
 * Silently degrades if AudioContext is unavailable or the browser blocks
 * audio creation (e.g. iOS Safari outside a user gesture). The visual
 * "ringing…" state continues to work regardless.
 */
export function useRingtone(): (active: boolean) => void {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const playingRef = useRef(false);

  const teardown = useCallback(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const oscillators = oscillatorsRef.current;

    try {
      if (ctx && gain) {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
      }
    } catch {
      // ignore — teardown is best-effort
    }

    // Stop oscillators and close the context after the fade-out completes.
    const timeoutId = window.setTimeout(() => {
      for (const osc of oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
      try {
        gain?.disconnect();
      } catch {
        // ignore
      }
      try {
        void ctx?.close();
      } catch {
        // ignore
      }
    }, 120);

    oscillatorsRef.current = [];
    gainRef.current = null;
    ctxRef.current = null;
    // We don't store the timeout ID to cancel because there's nothing to cancel —
    // if the component re-mounts and rings again, fresh nodes are created.
    void timeoutId;
  }, []);

  const setActive = useCallback(
    (active: boolean) => {
      if (active === playingRef.current) return;

      if (!active) {
        playingRef.current = false;
        teardown();
        return;
      }

      // Start
      try {
        const AudioCtor =
          typeof window !== "undefined"
            ? window.AudioContext ??
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext
            : undefined;
        if (!AudioCtor) return;

        const ctx = new AudioCtor();
        // If the browser created it suspended (iOS Safari), try to resume.
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }

        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);

        // US ringback = 440 Hz + 480 Hz sine tones mixed.
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.value = 440;
        osc1.connect(gain);

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.value = 480;
        osc2.connect(gain);

        osc1.start();
        osc2.start();

        // On/off pattern — slightly snappier than US standard (2s on / 4s off)
        // so a ~2.5 second ring reads as one clear burst.
        const BURST = 1.5;
        const SILENCE = 2.0;
        const CYCLE = BURST + SILENCE;
        const VOL = 0.1;
        const FADE = 0.25;
        const CYCLES = 12; // ~42s of ring scheduling max — more than enough

        const base = ctx.currentTime;
        for (let i = 0; i < CYCLES; i++) {
          const start = base + i * CYCLE;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(VOL, start + FADE);
          gain.gain.setValueAtTime(VOL, start + BURST - FADE);
          gain.gain.linearRampToValueAtTime(0, start + BURST);
        }

        ctxRef.current = ctx;
        gainRef.current = gain;
        oscillatorsRef.current = [osc1, osc2];
        playingRef.current = true;
      } catch {
        // Audio blocked or unavailable — the visual ringing state still works.
      }
    },
    [teardown]
  );

  // Ensure cleanup on unmount.
  useEffect(() => {
    return () => {
      if (playingRef.current) {
        playingRef.current = false;
        teardown();
      }
    };
  }, [teardown]);

  return setActive;
}
