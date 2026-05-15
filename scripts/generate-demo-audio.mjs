#!/usr/bin/env node
/**
 * Pre-generate Japanese TTS audio for the /demo page using Gemini TTS.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/generate-demo-audio.mjs
 *
 * Override the model:
 *   GEMINI_TTS_MODEL=gemini-3.1-flash-tts GEMINI_API_KEY=... node scripts/generate-demo-audio.mjs
 *
 * Writes WAV files to public/demo/audio/<id>.wav, matching the ids referenced
 * in src/app/demo/page.tsx. Re-run any time the script lines change.
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const API_KEY = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

if (!API_KEY) {
  console.error("Missing API key. Set GEMINI_API_KEY or LLM_API_KEY.");
  process.exit(1);
}

// Tutor voice (female) and learner voice (male).
// Gemini prebuilt voice names: Kore, Aoede, Leda, Callirhoe (female-ish),
// Puck, Charon, Fenrir, Orus (male-ish). Adjust to taste.
const TUTOR_VOICE = process.env.GEMINI_TUTOR_VOICE || "Kore";
const LEARNER_VOICE = process.env.GEMINI_LEARNER_VOICE || "Puck";

const LINES = [
  { id: "tutor-1",   role: "tutor",   text: "今日は何を食べましたか？" },
  { id: "learner-1", role: "learner", text: "りんごを食べました。" },
  { id: "learner-2", role: "learner", text: "「柿」は何ですか？" },
  { id: "tutor-2",   role: "tutor",   text: "「柿」は果物です。英語で persimmon です。" },
  { id: "learner-3", role: "learner", text: "柿は食べました。" },
  { id: "tutor-3",   role: "tutor",   text: "「柿を食べました」が正しいですね。" },
  { id: "learner-4", role: "learner", text: "本は読みました。" },
  { id: "tutor-4",   role: "tutor",   text: "前回聞いていた「柿」、お母さんについて例文を作ってみましょう。" },
  { id: "learner-5", role: "learner", text: "母は柿を食べるのが好きです。" },
];

const outDir = path.join(process.cwd(), "public", "demo", "audio");
fs.mkdirSync(outDir, { recursive: true });

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Wrap raw PCM (Gemini returns 24kHz mono 16-bit by default) in a WAV header.
function wavHeader(dataLen, sampleRate = 24000, channels = 1, bits = 16) {
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  buf.writeUInt16LE((channels * bits) / 8, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

for (const line of LINES) {
  const voice = line.role === "tutor" ? TUTOR_VOICE : LEARNER_VOICE;
  const outPath = path.join(outDir, `${line.id}.wav`);
  process.stdout.write(`→ ${line.id} (${voice}) ... `);

  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: line.text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const part = res?.candidates?.[0]?.content?.parts?.[0];
    const b64 = part?.inlineData?.data;
    if (!b64) {
      throw new Error("No audio data in response");
    }
    const pcm = Buffer.from(b64, "base64");
    const wav = Buffer.concat([wavHeader(pcm.length), pcm]);
    fs.writeFileSync(outPath, wav);
    console.log(`ok (${(wav.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.log("FAILED");
    console.error(`  ${err?.message ?? err}`);
    process.exitCode = 1;
  }
}

console.log(`\nDone. Files written to ${outDir}`);
console.log(`Model: ${MODEL}`);
console.log(`Voices — tutor: ${TUTOR_VOICE}, learner: ${LEARNER_VOICE}`);
