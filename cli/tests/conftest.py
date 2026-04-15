"""Shared fixtures for tutor prompt tests."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest


MINIMAL_TEMPLATE = """You are a tutor.

LEARNER PROFILE:
- Name: {learner_name}
- Native language (L1): {native_language}
- Learning (L2): {target_language}
- Proficiency: {level_note}
- Correction tolerance: {correction_tolerance}

ACTIVE ERRORS:
{active_errors}

RECENT CORRECTIONS:
{recent_corrections}

WEAK GRAMMAR:
{weak_grammar}

AVOIDANCE:
{avoidance_patterns}

L1 INTERFERENCE:
{l1_interference}

PRACTICE FOCUS:
{practice_focus}

INTERESTS:
{learner_interests}

VOCAB DUE:
{vocab_due}

GRAMMAR DUE:
{grammar_due}

RESPONSE FORMAT:
[RESPONSE]...[/RESPONSE]
[ANALYSIS]{{ "errors": [], "vocab_checks": [], "grammar_checks": [] }}[/ANALYSIS]
"""


@pytest.fixture
def learner() -> dict:
    return {
        "id": "test-learner-1",
        "name": "Alex",
        "native_language": "English",
        "target_language": "Japanese",
        "proficiency_level": "A2",
        "correction_tolerance": "moderate",
    }


@pytest.fixture
def stub_db(monkeypatch, tmp_path: Path):
    """Stub database lookups and point PROMPT_TEMPLATE_PATH at a minimal template."""
    import config
    import database as db

    monkeypatch.setattr(db, "get_active_errors", lambda _id: [])
    monkeypatch.setattr(db, "get_recent_corrections", lambda _sid: [])
    monkeypatch.setattr(db, "get_weak_grammar", lambda _id: [])
    monkeypatch.setattr(db, "get_avoidance_patterns", lambda _id: [])

    template_path = tmp_path / "system.txt"
    template_path.write_text(MINIMAL_TEMPLATE)
    monkeypatch.setattr(config, "PROMPT_TEMPLATE_PATH", template_path)


@pytest.fixture
def mock_llm(monkeypatch):
    """Replace the OpenAI client with a mock exposing .set_reply(text)."""
    import tutor

    mock = MagicMock()
    reply = {"text": "[RESPONSE]hi[/RESPONSE]"}

    def set_reply(text: str) -> None:
        reply["text"] = text

    def create(**_kwargs):
        completion = MagicMock()
        completion.choices = [MagicMock(message=MagicMock(content=reply["text"]))]
        return completion

    mock.chat.completions.create = create
    mock.set_reply = set_reply

    monkeypatch.setattr(tutor, "_client", mock)
    tutor.reset_history()
    return mock
