"""Unit tests for prompt wiring and response parsing (no real LLM)."""

import json

import tutor


def test_system_prompt_includes_learner_profile(learner, stub_db):
    prompt = tutor._build_system_prompt(learner)
    assert "Alex" in prompt
    assert "English" in prompt
    assert "Japanese" in prompt
    assert "A2" in prompt


def test_chat_parses_response_and_analysis(learner, stub_db, mock_llm):
    analysis = {"errors": [], "vocab_checks": [{"word": "neko", "status": "known"}], "grammar_checks": []}
    mock_llm.set_reply(
        f"[RESPONSE]\nこんにちは！\n[/RESPONSE]\n[ANALYSIS]{json.dumps(analysis)}[/ANALYSIS]"
    )
    result = tutor.chat("hello", learner)
    assert result["response"] == "こんにちは！"
    assert result["analysis"] == analysis


def test_chat_handles_missing_analysis_block(learner, stub_db, mock_llm):
    mock_llm.set_reply("[RESPONSE]just a reply[/RESPONSE]")
    result = tutor.chat("hi", learner)
    assert result["response"] == "just a reply"
    assert result["analysis"] is None
