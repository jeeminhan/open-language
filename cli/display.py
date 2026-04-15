"""Rich terminal formatting for Voice Tutor."""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.markdown import Markdown

import config

console = Console()


def show_header(learner: dict, session_number: int) -> None:
    header = Text()
    header.append("Voice Tutor v0.1\n", style="bold")
    header.append(f"Model: {config.LLM_MODEL}", style="dim")
    header.append(" | ", style="dim")
    header.append(f"Learner: {learner['name']}", style="bold cyan")
    header.append(" | ", style="dim")
    header.append(f"{learner['native_language']} → {learner['target_language']}", style="yellow")
    header.append(f"\nSession #{session_number}", style="dim")
    header.append(" | Type ", style="dim")
    header.append("/help", style="bold green")
    header.append(" for commands", style="dim")

    console.print(Panel(header, border_style="bright_blue", padding=(0, 2)))
    console.print()


def show_tutor_response(response: str, correction_action: str | None = None) -> None:
    style = "bright_white"
    border = "bright_blue"

    console.print()
    console.print(Text("Tutor", style=f"bold {border}"))
    for line in response.split("\n"):
        console.print(f"  {line}", style=style)
    console.print()


def show_correction_tip(tip: str) -> None:
    console.print()
    console.print("  " + "─" * 40, style="dim")
    for line in tip.split("\n"):
        console.print(f"  {line}", style="bright_yellow")
    console.print()


def show_session_summary(session: dict, new_patterns: list[str] | None = None,
                          improving: list[str] | None = None) -> None:
    duration_s = session.get("duration_seconds", 0) or 0
    minutes = duration_s // 60

    console.print()
    table = Table(title="Session Complete", border_style="green", show_header=False, padding=(0, 2))
    table.add_column("Label", style="dim")
    table.add_column("Value", style="bold")
    table.add_row("Duration", f"{minutes} minutes")
    table.add_row("Turns", str(session.get("total_turns", 0)))
    table.add_row("Errors detected", str(session.get("errors_detected", 0)))
    table.add_row("Corrections given", str(session.get("corrections_given", 0)))

    if new_patterns:
        table.add_row("New patterns", ", ".join(new_patterns))
    if improving:
        table.add_row("Improving", ", ".join(improving))

    console.print(table)
    console.print("\n  Data saved. Use /export to generate fine-tuning data.\n", style="dim")


def show_status(learner: dict, session_count: int, total_hours: float,
                top_errors: list[dict]) -> None:
    console.print()
    panel_text = Text()
    panel_text.append(f"Learner Profile: {learner['name']}\n", style="bold cyan")
    panel_text.append(f"{learner['native_language']} → {learner['target_language']}", style="yellow")
    panel_text.append(f" | Level: {learner['proficiency_level'] or '?'}", style="dim")
    panel_text.append(f" | Sessions: {session_count}\n", style="dim")
    panel_text.append(f"Total practice time: {total_hours:.1f} hours", style="dim")

    console.print(Panel(panel_text, border_style="cyan", padding=(0, 2)))

    if top_errors:
        console.print()
        table = Table(title="Top Error Patterns", border_style="red")
        table.add_column("#", style="dim", width=3)
        table.add_column("Pattern")
        table.add_column("Count", justify="right")
        table.add_column("Status")

        for i, err in enumerate(top_errors[:10], 1):
            status_style = {
                "active": "red",
                "improving": "yellow",
                "resolved": "green",
            }.get(err["status"], "dim")
            table.add_row(
                str(i),
                err["description"],
                str(err["occurrence_count"]),
                Text(err["status"], style=status_style),
            )
        console.print(table)
    else:
        console.print("  No error patterns recorded yet.\n", style="dim")
    console.print()


def show_errors(errors: list[dict]) -> None:
    if not errors:
        console.print("  No error patterns recorded.\n", style="dim")
        return

    console.print()
    for i, err in enumerate(errors, 1):
        sev_style = {"high": "red", "medium": "yellow", "low": "green"}.get(err["severity"], "dim")
        status_style = {"active": "red", "improving": "yellow", "resolved": "green"}.get(err["status"], "dim")

        header = Text()
        header.append(f"{i}. ", style="dim")
        header.append(err["description"], style="bold")
        header.append(f"  [{err['category']}]", style="dim")
        console.print(header)

        details = Text()
        details.append("   Count: ", style="dim")
        details.append(str(err["occurrence_count"]))
        details.append("  Corrected: ", style="dim")
        details.append(str(err["times_corrected"]))
        details.append("  Severity: ", style="dim")
        details.append(err["severity"], style=sev_style)
        details.append("  Status: ", style="dim")
        details.append(err["status"], style=status_style)
        console.print(details)

        if err.get("l1_source"):
            console.print(f"   Why: {err['l1_source']}", style="dim italic")

        # Show example utterances
        import json
        examples = json.loads(err.get("example_utterances") or "[]")
        if examples:
            console.print("   Examples:", style="dim")
            for ex in examples[-5:]:  # show last 5
                console.print(f"     {ex}", style="bright_red")

        console.print()
    console.print()


def show_grammar(grammar: list[dict]) -> None:
    if not grammar:
        console.print("  No grammar patterns tracked yet.\n", style="dim")
        return

    console.print()
    table = Table(title="Grammar Inventory", border_style="blue")
    table.add_column("Pattern")
    table.add_column("Level", style="dim")
    table.add_column("Correct", justify="right", style="green")
    table.add_column("Incorrect", justify="right", style="red")
    table.add_column("Mastery", justify="right")

    for g in grammar:
        total = g["correct_uses"] + g["incorrect_uses"]
        if total < 3:
            mastery_text = Text("(need more data)", style="dim")
        else:
            score = g["mastery_score"]
            style = "green" if score >= 80 else "yellow" if score >= 40 else "red"
            mastery_text = Text(f"{score:.0f}%", style=style)
        table.add_row(
            g["pattern"],
            g["level"] or "—",
            str(g["correct_uses"]),
            str(g["incorrect_uses"]),
            mastery_text,
        )
    console.print(table)
    console.print()


def show_vocab(stats: dict) -> None:
    console.print()
    console.print(f"  Total unique words: [bold]{stats['total_unique']}[/bold]")
    if stats["most_used"]:
        console.print("  Most used:", style="dim")
        for w in stats["most_used"][:10]:
            console.print(f"    {w['word']} ({w['times_used']}x)")
    console.print()


def show_history(sessions: list[dict]) -> None:
    if not sessions:
        console.print("  No past sessions.\n", style="dim")
        return

    console.print()
    table = Table(title="Recent Sessions", border_style="blue")
    table.add_column("Date")
    table.add_column("Duration", justify="right")
    table.add_column("Turns", justify="right")
    table.add_column("Errors", justify="right")
    table.add_column("Corrections", justify="right")

    for s in sessions:
        dur = s.get("duration_seconds") or 0
        table.add_row(
            (s["started_at"] or "")[:16],
            f"{dur // 60}m",
            str(s["total_turns"]),
            str(s["errors_detected"]),
            str(s["corrections_given"]),
        )
    console.print(table)
    console.print()


def show_help() -> None:
    console.print()
    table = Table(title="Commands", border_style="green", show_header=False)
    table.add_column("Command", style="bold green")
    table.add_column("Description")
    table.add_row("/status", "Learner profile summary + top errors")
    table.add_row("/errors", "All error patterns with counts")
    table.add_row("/grammar", "Grammar inventory sorted by mastery")
    table.add_row("/vocab", "Vocabulary stats")
    table.add_row("/history", "Last 5 session summaries")
    table.add_row("/test", "Take a level test (auto-updates your level)")
    table.add_row("/turns", "Progress toward 500 turns (fine-tuning goal)")
    table.add_row("/export", "Export turns as JSONL for fine-tuning")
    table.add_row("/annotate", "Annotate the last turn (rate quality 1-5)")
    table.add_row("/model [name]", "Switch Ollama model")
    table.add_row("/level [level]", "Update proficiency level")
    table.add_row("/help", "Show this help")
    table.add_row("/quit", "End session with summary")
    console.print(table)
    console.print()


def prompt_input() -> str:
    try:
        return console.input("[bold green]You > [/]")
    except (EOFError, KeyboardInterrupt):
        return "/quit"


def show_error(msg: str) -> None:
    console.print(f"  [red]Error:[/red] {msg}")


def show_info(msg: str) -> None:
    console.print(f"  [dim]{msg}[/dim]")
