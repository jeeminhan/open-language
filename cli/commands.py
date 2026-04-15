"""Handle slash commands within conversation sessions."""

import json

import database as db
import display
import export as exp
import level_test
import tutor


def handle_command(command: str, learner: dict, session_id: str) -> bool:
    """Handle a slash command. Returns True if the session should end."""
    parts = command.strip().split(maxsplit=1)
    cmd = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else None

    if cmd in ("/quit", "/exit", "/q"):
        return True

    if cmd == "/help":
        display.show_help()

    elif cmd == "/status":
        _cmd_status(learner)

    elif cmd == "/errors":
        errors = db.get_all_errors(learner["id"])
        display.show_errors(errors)

    elif cmd == "/grammar":
        grammar = db.get_all_grammar(learner["id"])
        display.show_grammar(grammar)

    elif cmd == "/vocab":
        stats = db.get_vocabulary_stats(learner["id"])
        display.show_vocab(stats)

    elif cmd == "/history":
        sessions = db.get_recent_sessions(learner["id"])
        display.show_history(sessions)

    elif cmd == "/turns":
        total = db.get_total_turns(learner["id"])
        remaining = max(0, 500 - total)
        bar_filled = min(50, int(total / 500 * 50))
        bar = "█" * bar_filled + "░" * (50 - bar_filled)
        display.console.print(f"\n  Turns collected: [bold]{total}[/bold] / 500")
        display.console.print(f"  [{bar}]")
        if remaining > 0:
            display.console.print(f"  {remaining} more turns until fine-tuning ready\n", style="dim")
        else:
            display.console.print("  Ready for fine-tuning! Use /export to generate training data.\n", style="bold green")

    elif cmd == "/export":
        path = exp.export_turns(learner["id"])
        display.show_info(f"Exported to {path}")

    elif cmd == "/test":
        level_test.run_test(learner)

    elif cmd == "/annotate":
        _cmd_annotate(session_id)

    elif cmd == "/model":
        if arg:
            tutor.switch_model(arg)
            display.show_info(f"Switched model to: {arg}")
        else:
            display.show_error("Usage: /model <model_name>")

    elif cmd == "/level":
        if not arg:
            display.console.print(f"\n  Current level: [bold yellow]{learner.get('proficiency_level', '?')}[/bold yellow]")
            display.console.print("  [dim]1)[/dim] Set manually  [dim]2)[/dim] Take level test\n")
            try:
                choice = display.console.input("  [green]Choose > [/]").strip()
            except (EOFError, KeyboardInterrupt):
                return False
            if choice == "2":
                level_test.run_test(learner)
                return False
            elif choice == "1":
                from rich.prompt import Prompt
                arg = Prompt.ask("  Level", choices=["A1", "A2", "B1", "B2", "C1", "C2"])
            else:
                return False
        conn = db._connect()
        conn.execute(
            "UPDATE learners SET proficiency_level = ? WHERE id = ?",
            (arg.upper(), learner["id"]),
        )
        conn.commit()
        conn.close()
        learner["proficiency_level"] = arg.upper()
        display.show_info(f"Updated level to: {arg.upper()}")

    else:
        display.show_error(f"Unknown command: {cmd}. Type /help for available commands.")

    return False


def _cmd_status(learner: dict) -> None:
    session_count = db.get_session_count(learner["id"])
    total_seconds = db.get_total_practice_seconds(learner["id"])
    total_hours = total_seconds / 3600
    top_errors = db.get_active_errors(learner["id"], limit=5)
    display.show_status(learner, session_count, total_hours, top_errors)


def _cmd_annotate(session_id: str) -> None:
    last_turn = db.get_last_turn(session_id)
    if not last_turn:
        display.show_error("No turns in this session yet.")
        return

    display.console.print("\n  [bold]Annotating last turn:[/bold]")
    display.console.print(f"  User: {last_turn['user_message']}", style="dim")
    display.console.print(f"  Tutor: {last_turn['tutor_response']}", style="dim")
    display.console.print()

    try:
        score_str = display.console.input("  Quality score (1-5): ")
        score = int(score_str)
        if score < 1 or score > 5:
            display.show_error("Score must be 1-5.")
            return
    except (ValueError, EOFError):
        display.show_error("Invalid score.")
        return

    ideal = None
    if score <= 3:
        try:
            ideal = display.console.input("  Ideal response (or Enter to skip): ")
            if not ideal.strip():
                ideal = None
        except EOFError:
            ideal = None

    try:
        notes = display.console.input("  Notes (or Enter to skip): ")
        if not notes.strip():
            notes = None
    except EOFError:
        notes = None

    db.create_annotation(
        turn_id=last_turn["id"],
        quality_score=score,
        ideal_response=ideal,
        notes=notes,
    )
    display.show_info("Annotation saved.")
