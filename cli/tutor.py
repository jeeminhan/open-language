"""LLM interaction, prompt building, response parsing."""

import json
import re
from typing import Any

from openai import OpenAI

import config
import database as db


_client: OpenAI | None = None
_conversation_history: list[dict[str, str]] = []


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=config.LLM_BASE_URL,
            api_key=config.LLM_API_KEY,
        )
    return _client


def reset_history() -> None:
    global _conversation_history
    _conversation_history = []


def switch_model(model_name: str) -> None:
    config.LLM_MODEL = model_name


def _build_system_prompt(learner: dict) -> str:
    template = config.PROMPT_TEMPLATE_PATH.read_text()

    active_errors = db.get_active_errors(learner["id"])
    if active_errors:
        errors_text = "\n".join(
            f"- {e['description']} ({e['category']}, {e['occurrence_count']}x, {e['status']})"
            for e in active_errors
        )
    else:
        errors_text = "None yet — this is a new learner or no errors recorded."

    recent_corrections: list[dict] = []
    if hasattr(_build_system_prompt, "_session_id") and _build_system_prompt._session_id:
        recent_corrections = db.get_recent_corrections(_build_system_prompt._session_id)
    if recent_corrections:
        corrections_text = "\n".join(
            f"- Turn {c['turn_number']}: {c['correction_type']} — {c['correction_reasoning'] or 'N/A'}"
            for c in recent_corrections
        )
    else:
        corrections_text = "None this session."

    weak_grammar = db.get_weak_grammar(learner["id"])
    if weak_grammar:
        grammar_text = "\n".join(
            f"- {g['pattern']} (mastery: {g['mastery_score']:.0f}%)"
            for g in weak_grammar[:10]
        )
    else:
        grammar_text = "No weak areas identified yet."

    avoidance = db.get_avoidance_patterns(learner["id"])
    if avoidance:
        avoidance_text = "\n".join(f"- {a['description']}" for a in avoidance)
    else:
        avoidance_text = "None identified yet."

    return template.format(
        learner_name=learner["name"],
        native_language=learner["native_language"],
        target_language=learner["target_language"],
        proficiency_level=learner["proficiency_level"] or "A2",
        correction_tolerance=learner["correction_tolerance"] or "moderate",
        active_errors=errors_text,
        recent_corrections=corrections_text,
        weak_grammar=grammar_text,
        avoidance_patterns=avoidance_text,
    )


def set_session_id(session_id: str) -> None:
    _build_system_prompt._session_id = session_id


def chat(user_message: str, learner: dict) -> dict[str, Any]:
    """Send a message and return parsed response.

    Returns: {"response": str, "analysis": dict | None, "raw": str}
    """
    client = _get_client()
    system_prompt = _build_system_prompt(learner)

    _conversation_history.append({"role": "user", "content": user_message})

    # Keep only the last MAX_CONTEXT_TURNS exchanges
    max_messages = config.MAX_CONTEXT_TURNS * 2
    trimmed = _conversation_history[-max_messages:]

    messages = [{"role": "system", "content": system_prompt}] + trimmed

    try:
        completion = client.chat.completions.create(
            model=config.LLM_MODEL,
            messages=messages,
            temperature=0.7,
        )
        raw = completion.choices[0].message.content or ""
    except Exception as e:
        raw = f"[RESPONSE]\nSorry, I'm having trouble connecting to the language model. Error: {e}\n[/RESPONSE]"

    response_text, analysis = _parse_response(raw)

    _conversation_history.append({"role": "assistant", "content": raw})

    return {"response": response_text, "analysis": analysis, "raw": raw}


def _parse_response(raw: str) -> tuple[str, dict | None]:
    """Extract [RESPONSE] and [ANALYSIS] blocks from LLM output."""
    # Extract response
    response_match = re.search(r"\[RESPONSE\]\s*(.*?)\s*\[/RESPONSE\]", raw, re.DOTALL)
    response_text = response_match.group(1).strip() if response_match else raw.strip()

    # Extract analysis
    analysis = None
    analysis_match = re.search(r"\[ANALYSIS\]\s*(.*?)\s*\[/ANALYSIS\]", raw, re.DOTALL)
    if analysis_match:
        try:
            analysis = json.loads(analysis_match.group(1).strip())
        except json.JSONDecodeError:
            # Try to fix common JSON issues
            text = analysis_match.group(1).strip()
            text = re.sub(r",\s*}", "}", text)
            text = re.sub(r",\s*]", "]", text)
            try:
                analysis = json.loads(text)
            except json.JSONDecodeError:
                analysis = None

    return response_text, analysis
