"""Text-to-speech — macOS `say` (built-in) with cloud TTS option."""

import os
import subprocess
import tempfile
from pathlib import Path

import config


# macOS voice mapping by language
_MACOS_VOICES = {
    "Korean": "Yuna",
    "Japanese": "Kyoko",
    "English": "Samantha",
    "Chinese": "Ting-Ting",
    "Spanish": "Monica",
    "French": "Thomas",
    "German": "Anna",
}


def speak(text: str, language: str | None = None) -> None:
    """Speak text aloud using the configured TTS engine."""
    engine = config.TTS_ENGINE

    if engine == "none":
        return

    if engine == "macos" or engine == "say":
        _speak_macos(text, language)
    elif engine == "gemini":
        _speak_gemini(text, language)
    else:
        # Default to macOS say on darwin
        _speak_macos(text, language)


def _speak_macos(text: str, language: str | None = None) -> None:
    """Use macOS built-in `say` command. Zero deps, works great."""
    voice = _MACOS_VOICES.get(language or "", "Samantha")

    # Check if voice is available, fall back to default
    try:
        result = subprocess.run(
            ["say", "-v", voice, "--", text],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            # Fall back to default voice
            subprocess.run(["say", "--", text], capture_output=True, timeout=30)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass  # Not on macOS or timed out


def _speak_gemini(text: str, language: str | None = None) -> None:
    """Use Gemini's TTS capabilities (future upgrade path)."""
    # Placeholder for Gemini TTS when available
    _speak_macos(text, language)


def list_macos_voices() -> list[str]:
    """List available macOS voices."""
    try:
        result = subprocess.run(
            ["say", "-v", "?"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip().split("\n")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []


def is_available() -> bool:
    """Check if TTS is available."""
    if config.TTS_ENGINE == "none":
        return False
    try:
        subprocess.run(["say", ""], capture_output=True, timeout=2)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
