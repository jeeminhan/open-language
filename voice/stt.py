"""Speech-to-text — Groq Whisper API (cloud, free) or local Whisper fallback."""

import json
import os
from typing import Any

from openai import OpenAI

import config


def _get_groq_client() -> OpenAI | None:
    """Get Groq client for cloud Whisper. Returns None if no API key."""
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        return None
    return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=key)


def _get_gemini_client() -> OpenAI:
    """Fall back to Gemini for transcription."""
    return OpenAI(base_url=config.LLM_BASE_URL, api_key=config.LLM_API_KEY)


def transcribe(audio_path: str) -> dict[str, Any]:
    """Transcribe audio file. Returns {"text": str, "language": str, "confidence": float}.

    Tries Groq Whisper API first (free, fast), falls back to Gemini.
    """
    # Try Groq Whisper first
    groq = _get_groq_client()
    if groq:
        return _transcribe_groq(groq, audio_path)

    # Fall back to Gemini audio understanding
    return _transcribe_gemini(audio_path)


def _transcribe_groq(client: OpenAI, audio_path: str) -> dict[str, Any]:
    """Transcribe using Groq's free Whisper API."""
    try:
        with open(audio_path, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=f,
                response_format="verbose_json",
            )

        text = result.text if hasattr(result, 'text') else str(result)
        language = getattr(result, 'language', 'unknown')

        return {
            "text": text,
            "language": language,
            "confidence": 0.9,  # Groq doesn't return confidence
            "source": "groq-whisper",
        }
    except Exception as e:
        return {"text": "", "language": "unknown", "confidence": 0.0, "error": str(e)}


def _transcribe_gemini(audio_path: str) -> dict[str, Any]:
    """Transcribe using Gemini's audio understanding via file upload."""
    import base64

    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Use Gemini's native API for audio (not OpenAI-compatible endpoint)
        import httpx
        resp = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{config.LLM_MODEL}:generateContent",
            params={"key": config.LLM_API_KEY},
            json={
                "contents": [{
                    "parts": [
                        {"inlineData": {"mimeType": "audio/wav", "data": audio_b64}},
                        {"text": "Transcribe this audio exactly as spoken. Return only the transcription, nothing else."},
                    ]
                }]
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]

        return {
            "text": text.strip(),
            "language": "auto",
            "confidence": 0.85,
            "source": "gemini",
        }
    except Exception as e:
        return {"text": "", "language": "unknown", "confidence": 0.0, "error": str(e)}
