"""Export conversation data for fine-tuning."""

import json
from datetime import datetime
from pathlib import Path

import config
import database as db


def export_turns(learner_id: str) -> str:
    """Export all turns as JSONL for fine-tuning. Returns the output file path."""
    config.EXPORT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = config.EXPORT_DIR / f"turns_{timestamp}.jsonl"

    learner = db.get_learner()
    conn = db._connect()
    rows = conn.execute(
        "SELECT t.*, s.learner_id FROM turns t "
        "JOIN sessions s ON t.session_id = s.id "
        "WHERE s.learner_id = ? ORDER BY t.created_at",
        (learner_id,),
    ).fetchall()
    conn.close()

    count = 0
    with open(output_path, "w", encoding="utf-8") as f:
        for row in rows:
            turn = dict(row)
            analysis = None
            if turn["analysis_json"]:
                try:
                    analysis = json.loads(turn["analysis_json"])
                except json.JSONDecodeError:
                    pass

            entry = {
                "input": {
                    "user_utterance": turn["user_message"],
                    "learner_context": {
                        "native_language": learner["native_language"] if learner else "",
                        "target_language": learner["target_language"] if learner else "",
                        "proficiency_level": learner["proficiency_level"] if learner else "",
                    },
                },
                "output": {
                    "response": turn["tutor_response"],
                    "correction_action": turn.get("correction_type"),
                    "reasoning": turn.get("correction_reasoning"),
                },
            }
            if analysis:
                entry["output"]["analysis"] = analysis

            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            count += 1

    return f"{output_path} ({count} turns)"


def export_annotations(learner_id: str) -> str:
    """Export annotated turns as a higher-quality dataset."""
    config.EXPORT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = config.EXPORT_DIR / f"annotated_{timestamp}.jsonl"

    learner = db.get_learner()
    conn = db._connect()
    rows = conn.execute(
        "SELECT t.*, a.quality_score, a.ideal_response, a.ideal_correction_action, a.notes "
        "FROM annotations a "
        "JOIN turns t ON a.turn_id = t.id "
        "JOIN sessions s ON t.session_id = s.id "
        "WHERE s.learner_id = ? ORDER BY t.created_at",
        (learner_id,),
    ).fetchall()
    conn.close()

    count = 0
    with open(output_path, "w", encoding="utf-8") as f:
        for row in rows:
            turn = dict(row)
            entry = {
                "input": {
                    "user_utterance": turn["user_message"],
                    "learner_context": {
                        "native_language": learner["native_language"] if learner else "",
                        "target_language": learner["target_language"] if learner else "",
                    },
                },
                "output": {
                    "response": turn.get("ideal_response") or turn["tutor_response"],
                    "correction_action": turn.get("ideal_correction_action") or turn.get("correction_type"),
                },
                "annotation": {
                    "quality_score": turn.get("quality_score"),
                    "notes": turn.get("notes"),
                },
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            count += 1

    return f"{output_path} ({count} annotated turns)"
