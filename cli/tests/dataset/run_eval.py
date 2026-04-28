#!/usr/bin/env python
"""Prompt testing runner.

Reads labeled examples from JSONL, runs each through tutor.chat(),
compares the predicted fields against the human labels, writes a report.

Usage (from cli/):
    .venv/bin/python tests/dataset/run_eval.py
    .venv/bin/python tests/dataset/run_eval.py --limit 1
    .venv/bin/python tests/dataset/run_eval.py --examples tests/dataset/data/examples.jsonl

Scope: tests prompts/system.txt output quality only. Not a pytest replacement.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable


# Make cli/ importable regardless of where this is invoked from.
CLI_DIR = Path(__file__).resolve().parents[2]
if str(CLI_DIR) not in sys.path:
    sys.path.insert(0, str(CLI_DIR))

import config  # noqa: E402
import database as db  # noqa: E402
import tutor  # noqa: E402


DATASET_DIR = CLI_DIR / "tests" / "dataset"

HIRAGANA = re.compile(r"[぀-ゟ]")
KATAKANA = re.compile(r"[゠-ヿ]")
HANGUL = re.compile(r"[가-힯]")

SCRIPT_CHECKS: dict[str, Callable[[str], bool]] = {
    "Japanese": lambda s: bool(HIRAGANA.search(s) or KATAKANA.search(s)),
    "Korean": lambda s: bool(HANGUL.search(s)),
}

# Fields the runner mechanically predicts from model output.
# `tone` is label-only until an LLM judge is wired up.
SCORED_FIELDS = {
    "correction_action",
    "errors_nonempty",
    "error_categories",
    "should_quiz_back",
    "response_language_ok",
}


def load_examples(path: Path) -> list[dict]:
    out: list[dict] = []
    for n, line in enumerate(path.read_text().splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        try:
            out.append(json.loads(stripped))
        except json.JSONDecodeError as e:
            raise ValueError(f"{path}:{n}: invalid JSON: {e}") from e
    return out


def seed_history(history: list[dict]) -> None:
    """Replay prior turns into tutor._conversation_history.

    Assistant turns get wrapped in [RESPONSE]...[/RESPONSE] to match the
    format the model's own prior replies would have used.
    """
    for turn in history:
        content = turn["content"]
        if turn["role"] == "assistant" and "[RESPONSE]" not in content:
            content = f"[RESPONSE]\n{content}\n[/RESPONSE]"
        tutor._conversation_history.append({"role": turn["role"], "content": content})


def predict(result: dict, example: dict) -> dict[str, Any]:
    analysis = result.get("analysis") or {}
    response = result.get("response") or ""
    target = example["learner"].get("target_language", "")
    script_ok = SCRIPT_CHECKS.get(target, lambda _s: True)

    errors = analysis.get("errors") or []
    categories = sorted({(e.get("type") or "").strip() for e in errors} - {""})

    return {
        "correction_action": analysis.get("correction_action"),
        "errors_nonempty": len(errors) > 0,
        "error_categories": categories,
        "should_quiz_back": "?" in response or "？" in response,
        "response_language_ok": script_ok(response),
    }


def score_field(field: str, expected: Any, actual: Any) -> bool:
    if field == "error_categories":
        if not isinstance(actual, list):
            return False
        # Substring match: each expected category must be a substring of some predicted one.
        return all(any(exp in pred for pred in actual) for exp in expected)
    return expected == actual


def score_example(labels: dict, predicted: dict) -> dict[str, bool]:
    return {
        field: score_field(field, labels[field], predicted.get(field))
        for field in labels
        if field in SCORED_FIELDS
    }


def stub_db() -> Callable[[], None]:
    """Replace DB lookups with no-ops so eval doesn't need a real learner row.

    Returns a restore function to undo the patches.
    """
    names = [
        "get_active_errors",
        "get_recent_corrections",
        "get_weak_grammar",
        "get_avoidance_patterns",
    ]
    original = {name: getattr(db, name) for name in names}
    for name in names:
        setattr(db, name, lambda *_a, **_k: [])

    def restore() -> None:
        for name, fn in original.items():
            setattr(db, name, fn)

    return restore


def run_one(example: dict) -> dict[str, Any]:
    tutor.reset_history()
    seed_history(example.get("history", []))
    learner = {"id": "eval-learner", **example["learner"]}
    result = tutor.chat(example["user_message"], learner)
    predicted = predict(result, example)
    scores = score_example(example["labels"], predicted)
    return {
        "id": example["id"],
        "source": example.get("source", "unknown"),
        "labels": example["labels"],
        "predicted": predicted,
        "scores": scores,
        "response": result["response"],
        "analysis": result["analysis"],
    }


def aggregate(predictions: list[dict]) -> dict[str, dict[str, int]]:
    totals: dict[str, dict[str, int]] = {}
    for p in predictions:
        for field, ok in p["scores"].items():
            t = totals.setdefault(field, {"pass": 0, "total": 0})
            t["total"] += 1
            if ok:
                t["pass"] += 1
    return totals


def aggregate_by_source(predictions: list[dict]) -> dict[str, dict[str, dict[str, int]]]:
    by_source: dict[str, dict[str, dict[str, int]]] = {}
    for p in predictions:
        src = p.get("source", "unknown")
        bucket = by_source.setdefault(src, {})
        for field, ok in p["scores"].items():
            t = bucket.setdefault(field, {"pass": 0, "total": 0})
            t["total"] += 1
            if ok:
                t["pass"] += 1
    return by_source


def render_report(predictions: list[dict], run_dir: Path) -> str:
    lines: list[str] = [
        f"# Eval run `{run_dir.name}`",
        "",
        f"- Model: `{config.LLM_MODEL}`",
        f"- Examples: {len(predictions)}",
        f"- Timestamp: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Field-level accuracy (overall)",
        "",
        "| Field | Passed | Accuracy |",
        "|---|---|---|",
    ]
    totals = aggregate(predictions)
    for field in sorted(totals):
        t = totals[field]
        pct = 100 * t["pass"] / t["total"] if t["total"] else 0.0
        lines.append(f"| `{field}` | {t['pass']}/{t['total']} | {pct:.1f}% |")

    by_source = aggregate_by_source(predictions)
    if len(by_source) > 1:
        lines += ["", "## Accuracy by source", ""]
        sources = sorted(by_source)
        fields = sorted(totals)
        header = "| Field | " + " | ".join(sources) + " |"
        sep = "|---|" + "---|" * len(sources)
        lines += [header, sep]
        for field in fields:
            row = [f"`{field}`"]
            for src in sources:
                t = by_source[src].get(field, {"pass": 0, "total": 0})
                pct = 100 * t["pass"] / t["total"] if t["total"] else 0.0
                row.append(f"{t['pass']}/{t['total']} ({pct:.0f}%)")
            lines.append("| " + " | ".join(row) + " |")

    failures = [p for p in predictions if not all(p["scores"].values())]
    if failures:
        lines += ["", "## Failures", ""]
        for p in failures:
            bad = [f for f, ok in p["scores"].items() if not ok]
            lines.append(f"### `{p['id']}` ({p['source']})")
            lines.append("")
            for f in bad:
                lines.append(
                    f"- **{f}** — expected `{p['labels'][f]!r}`, got `{p['predicted'].get(f)!r}`"
                )
            preview = (p["response"] or "").replace("\n", " ").strip()
            if len(preview) > 180:
                preview = preview[:177] + "..."
            lines.append(f"- response: `{preview}`")
            lines.append("")

    return "\n".join(lines) + "\n"


def write_report(predictions: list[dict], run_dir: Path) -> str:
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "predictions.jsonl").write_text(
        "\n".join(json.dumps(p, ensure_ascii=False) for p in predictions) + "\n"
    )
    report = render_report(predictions, run_dir)
    (run_dir / "report.md").write_text(report)
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--examples", type=Path, default=DATASET_DIR / "data" / "examples.jsonl")
    ap.add_argument("--limit", type=int, default=None, help="Run only the first N examples")
    ap.add_argument("--run-dir", type=Path, default=None)
    args = ap.parse_args()

    examples = load_examples(args.examples)
    if args.limit:
        examples = examples[: args.limit]
    if not examples:
        print(f"No examples found in {args.examples}", file=sys.stderr)
        return 1

    run_dir = args.run_dir or (DATASET_DIR / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S"))

    restore = stub_db()
    try:
        predictions: list[dict] = []
        for i, ex in enumerate(examples, 1):
            print(f"[{i}/{len(examples)}] {ex['id']}", flush=True)
            predictions.append(run_one(ex))
    finally:
        restore()

    report = write_report(predictions, run_dir)
    print()
    print(report)
    print(f"Report: {run_dir / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
