"""Configuration for Voice Tutor."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent

# LLM Provider — supports Gemini, Groq, OpenAI, or Ollama
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "voice_tutor.db"))
MODE = os.getenv("MODE", "text")
TTS_ENGINE = os.getenv("TTS_ENGINE", "none")
STT_MODEL = os.getenv("STT_MODEL", "base")
VAD_SILENCE_THRESHOLD = float(os.getenv("VAD_SILENCE_THRESHOLD", "1.5"))
MAX_CONTEXT_TURNS = int(os.getenv("MAX_CONTEXT_TURNS", "10"))
PUSH_TO_TALK = os.getenv("PUSH_TO_TALK", "true").lower() == "true"
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", "3000"))
EXPORT_DIR = BASE_DIR / "exports"
PROMPT_TEMPLATE_PATH = BASE_DIR / "prompts" / "system.txt"
