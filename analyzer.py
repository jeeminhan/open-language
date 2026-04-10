"""Process analysis JSON from LLM and update learner profile in the database."""

from typing import Any

import database as db


def process_analysis(learner_id: str, session_id: str, analysis: dict[str, Any],
                      user_message: str) -> dict[str, int]:
    """Process an analysis block and update all tracking tables.

    Returns counts: {"errors": int, "corrections": int, "code_switches": int}
    """
    errors_count = 0
    corrections_count = 0
    code_switches = 0

    correction_action = analysis.get("correction_action", "none")
    corrected = correction_action in ("recast", "correct_explicitly")

    # Process errors
    for error in analysis.get("errors", []):
        db.upsert_error_pattern(
            learner_id=learner_id,
            category=error.get("type", "unknown"),
            description=error.get("pattern_description", error.get("type", "unknown")),
            l1_source=error.get("l1_source"),
            severity=error.get("severity", "medium"),
            example=error.get("observed", user_message),
            corrected=corrected,
        )
        errors_count += 1

        # Also track in grammar inventory as incorrect use
        if error.get("type"):
            db.upsert_grammar(
                learner_id=learner_id,
                pattern=error.get("pattern_description", error["type"]),
                level=None,
                correct=False,
                example=error.get("observed", user_message),
            )

    # Process correct grammar usage
    for grammar in analysis.get("grammar_used_correctly", []):
        db.upsert_grammar(
            learner_id=learner_id,
            pattern=grammar.get("pattern", "unknown"),
            level=grammar.get("level"),
            correct=True,
            example=grammar.get("example", user_message),
        )

    # Process vocabulary
    for word in analysis.get("vocabulary_used", []):
        if isinstance(word, str) and word.strip():
            db.upsert_vocabulary(
                learner_id=learner_id,
                word=word.strip().lower(),
                language="target",
            )

    # Count corrections
    if corrected:
        corrections_count = 1

    # Check for code-switching mentions
    fluency_notes = analysis.get("fluency_notes", "")
    if isinstance(fluency_notes, str) and "code-switch" in fluency_notes.lower():
        code_switches = 1

    # Update session counters
    db.update_session_counters(
        session_id=session_id,
        errors=errors_count,
        corrections=corrections_count,
        code_switches=code_switches,
    )

    return {
        "errors": errors_count,
        "corrections": corrections_count,
        "code_switches": code_switches,
    }
