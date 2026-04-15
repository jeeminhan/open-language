"""End-to-end prompt evaluation. Calls the real LLM — opt-in via `-m eval`."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import pytest
import yaml

import config
import database as db
import tutor


SCENARIOS_PATH = Path(__file__).parent / "scenarios.yaml"
RUNS_DIR = Path(__file__).parent / "runs"

HIRAGANA = re.compile(r"[\u3040-\u309F]")
KATAKANA = re.compile(r"[\u30A0-\u30FF]")
HANGUL = re.compile(r"[\uAC00-\uD7AF]")


def _load_scenarios() -> list[dict]:
    with SCENARIOS_PATH.open() as f:
        return yaml.safe_load(f)


def _check(expect: dict, response: str, analysis: dict | None) -> str | None:
    """Return None if check passes, else a failure message."""
    kind = expect["type"]
    if kind == "response_contains_any":
        needles = expect["values"]
        if not any(n in response for n in needles):
            return f"response missing all of {needles!r}"
        return None
    if kind == "response_language":
        script = expect["script"]
        if script == "hiragana_or_katakana" and not (HIRAGANA.search(response) or KATAKANA.search(response)):
            return "response has no hiragana/katakana"
        if script == "hangul" and not HANGUL.search(response):
            return "response has no hangul"
        return None
    if kind == "analysis_has_key":
        if analysis is None:
            return "analysis block missing"
        if expect["key"] not in analysis:
            return f"analysis missing key {expect['key']!r}"
        return None
    if kind == "analysis_errors_nonempty":
        if analysis is None:
            return "analysis block missing"
        if not analysis.get("errors"):
            return "analysis.errors is empty"
        return None
    return f"unknown check type {kind!r}"


def _log_run(scenario_name: str, payload: dict, run_dir: Path) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    out = run_dir / f"{scenario_name}.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


@pytest.fixture(scope="module")
def run_dir() -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = RUNS_DIR / ts
    path.mkdir(parents=True, exist_ok=True)
    return path


@pytest.mark.eval
@pytest.mark.parametrize("scenario", _load_scenarios(), ids=lambda s: s["name"])
def test_scenario(scenario: dict, run_dir: Path, monkeypatch) -> None:
    # Stub DB so eval doesn't require a real learner row
    monkeypatch.setattr(db, "get_active_errors", lambda _id: [])
    monkeypatch.setattr(db, "get_recent_corrections", lambda _sid: [])
    monkeypatch.setattr(db, "get_weak_grammar", lambda _id: [])
    monkeypatch.setattr(db, "get_avoidance_patterns", lambda _id: [])
    tutor.reset_history()

    learner = {"id": "eval-learner", **scenario["learner"]}
    system_prompt = tutor._build_system_prompt(learner)
    result = tutor.chat(scenario["user_message"], learner)

    failures: list[str] = []
    for expect in scenario["expect"]:
        msg = _check(expect, result["response"], result["analysis"])
        if msg:
            failures.append(msg)

    _log_run(
        scenario["name"],
        {
            "scenario": scenario["name"],
            "model": config.LLM_MODEL,
            "timestamp": datetime.now().isoformat(),
            "user_message": scenario["user_message"],
            "system_prompt": system_prompt,
            "response": result["response"],
            "analysis": result["analysis"],
            "raw": result["raw"],
            "passed": not failures,
            "failures": failures,
        },
        run_dir,
    )

    if failures:
        pytest.fail("; ".join(failures) + f" (see {run_dir}/{scenario['name']}.json)")
