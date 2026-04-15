"""Adaptive level test — mix of multiple choice, correction, and free response."""

import json
from typing import Any

from openai import OpenAI

import config
import database as db
import display


def _get_client() -> OpenAI:
    return OpenAI(base_url=config.LLM_BASE_URL, api_key=config.LLM_API_KEY)


def run_test(learner: dict) -> None:
    """Run an adaptive level test and update learner profile."""
    target = learner["target_language"]
    native = learner["native_language"]

    display.console.print(f"\n  [bold]Level Test — {target}[/bold]")
    display.console.print("  Answer a mix of questions. Type the letter for multiple choice,")
    display.console.print("  or write your answer for other questions. Type [bold green]/skip[/bold green] to skip any question.\n")

    client = _get_client()

    # Ask Gemini to generate an adaptive test
    test_prompt = f"""Generate a language proficiency test for a {native} speaker learning {target}.

Create exactly 12 questions, 2 per level (A1, A2, B1, B2, C1, C2), in this exact order from easiest to hardest.

Mix these question types:
- "mc" (multiple choice): Give 4 options (a, b, c, d). Good for vocab, particles, conjugation.
- "correct" (sentence correction): Show a sentence with an error, ask them to fix it.
- "free" (free response): Ask them to write a sentence using a specific grammar pattern or respond to a prompt.

Return ONLY valid JSON, no markdown, no explanation. Use this exact format:
{{
  "questions": [
    {{
      "level": "A1",
      "type": "mc",
      "question": "the question text in {target}",
      "options": ["a) ...", "b) ...", "c) ...", "d) ..."],
      "answer": "b",
      "explanation": "brief explanation in {native}"
    }},
    {{
      "level": "A1",
      "type": "correct",
      "question": "Fix this sentence: [sentence with error]",
      "answer": "the corrected sentence",
      "explanation": "brief explanation in {native}"
    }},
    {{
      "level": "B1",
      "type": "free",
      "question": "Write a sentence using [grammar pattern]",
      "answer": "example correct answer",
      "explanation": "what to look for in {native}"
    }}
  ]
}}"""

    display.console.print("  Generating test...\n", style="dim")

    try:
        resp = client.chat.completions.create(
            model=config.LLM_MODEL,
            messages=[{"role": "user", "content": test_prompt}],
            temperature=0.7,
        )
        raw = resp.choices[0].message.content or ""
        # Strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        test_data = json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        display.show_error(f"Failed to generate test: {e}")
        return

    questions = test_data.get("questions", [])
    if not questions:
        display.show_error("No questions generated.")
        return

    # Run through questions
    results: list[dict[str, Any]] = []
    current_level = None

    for i, q in enumerate(questions, 1):
        level = q.get("level", "?")
        qtype = q.get("type", "mc")

        # Show level header when it changes
        if level != current_level:
            current_level = level
            display.console.print(f"  ── [bold yellow]{level}[/bold yellow] ──")

        # Show question
        display.console.print(f"\n  [bold]Q{i}.[/bold] {q['question']}")

        if qtype == "mc" and q.get("options"):
            for opt in q["options"]:
                display.console.print(f"      {opt}")

        if qtype == "correct":
            display.console.print("      [dim](Rewrite the corrected sentence)[/dim]")

        if qtype == "free":
            display.console.print("      [dim](Write your answer)[/dim]")

        # Get answer
        try:
            answer = display.console.input("\n  [green]Answer > [/]").strip()
        except (EOFError, KeyboardInterrupt):
            display.console.print("\n  Test cancelled.\n", style="dim")
            return

        if answer.lower() == "/skip":
            results.append({"level": level, "correct": False, "skipped": True})
            display.console.print("  [dim]Skipped[/dim]")
            continue

        # Grade the answer
        is_correct = _grade_answer(client, q, answer, target, native)

        results.append({"level": level, "correct": is_correct, "skipped": False})

        if is_correct:
            display.console.print("  [green]Correct![/green]")
        else:
            display.console.print(f"  [red]Not quite.[/red] {q.get('explanation', '')}")
            if qtype == "mc":
                display.console.print(f"  [dim]Answer: {q.get('answer', '?')}[/dim]")
            elif q.get("answer"):
                display.console.print(f"  [dim]Expected: {q['answer']}[/dim]")

    # Calculate level
    estimated_level = _estimate_level(results)

    display.console.print(f"\n  {'─' * 40}")
    display.console.print(f"\n  [bold]Test Complete![/bold]\n")

    # Show results per level
    levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
    for level in levels:
        level_results = [r for r in results if r["level"] == level]
        if not level_results:
            continue
        correct = sum(1 for r in level_results if r["correct"])
        total = len(level_results)
        skipped = sum(1 for r in level_results if r.get("skipped"))
        bar = "[green]●[/green]" * correct + "[red]●[/red]" * (total - correct - skipped) + "[dim]○[/dim]" * skipped
        display.console.print(f"  {level}: {bar}  {correct}/{total}")

    display.console.print(f"\n  [bold]Estimated level: [yellow]{estimated_level}[/yellow][/bold]")

    # Update profile
    old_level = learner.get("proficiency_level", "?")
    if estimated_level != old_level:
        display.console.print(f"  [dim]Updated from {old_level} → {estimated_level}[/dim]")
        conn = db._connect()
        conn.execute(
            "UPDATE learners SET proficiency_level = ? WHERE id = ?",
            (estimated_level, learner["id"]),
        )
        conn.commit()
        conn.close()
        learner["proficiency_level"] = estimated_level
    display.console.print()


def _grade_answer(client: OpenAI, question: dict, user_answer: str,
                   target_lang: str, native_lang: str) -> bool:
    """Use LLM to grade free-form and correction answers. Simple match for MC."""
    qtype = question.get("type", "mc")

    # Multiple choice — direct match
    if qtype == "mc":
        expected = question.get("answer", "").strip().lower()
        cleaned = user_answer.strip().lower().rstrip(".)").lstrip("(")
        # Handle both "b" and "b) answer text"
        if cleaned and cleaned[0] == expected[0] if expected else False:
            return True
        return cleaned == expected

    # For correction and free response, ask the LLM to grade
    grade_prompt = f"""Grade this {target_lang} language test answer. Be generous with minor differences.

Question: {question['question']}
Expected answer (or similar): {question.get('answer', 'N/A')}
Student's answer: {user_answer}

Is the student's answer correct or acceptably close? Consider meaning, grammar, and intent.
Respond with ONLY "correct" or "incorrect". Nothing else."""

    try:
        resp = client.chat.completions.create(
            model=config.LLM_MODEL,
            messages=[{"role": "user", "content": grade_prompt}],
            temperature=0.0,
        )
        result = (resp.choices[0].message.content or "").strip().lower()
        return "correct" in result
    except Exception:
        # On error, be generous
        return True


def _estimate_level(results: list[dict]) -> str:
    """Estimate CEFR level based on test results."""
    levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
    highest_passed = "A1"

    for level in levels:
        level_results = [r for r in results if r["level"] == level and not r.get("skipped")]
        if not level_results:
            continue
        correct = sum(1 for r in level_results if r["correct"])
        # Need at least 1 correct out of 2 to "pass" a level
        if correct >= 1:
            highest_passed = level

    return highest_passed
