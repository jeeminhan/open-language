"""Voice Tutor — CLI entry point and conversation loop."""

import json
import sys

from rich.prompt import Prompt

import config
import database as db
import display
import tutor
import analyzer
import commands
import level_test


def first_run_setup() -> dict:
    """Create learner profile on first run."""
    display.console.print("\n  [bold]Welcome to Voice Tutor![/bold]")
    display.console.print("  Let's set up your learner profile.\n")

    name = Prompt.ask("  Your name")
    native = Prompt.ask("  Your native language (L1)", default="Korean")
    target = Prompt.ask("  Language you're learning (L2)", default="English")
    tolerance = Prompt.ask("  Correction tolerance", choices=["low", "moderate", "high"], default="moderate")

    # Ask if they want to take a level test or set manually
    test_choice = Prompt.ask(
        "  Take a level test to find your level?",
        choices=["yes", "no"],
        default="yes",
    )

    learner = db.create_learner(
        name=name,
        native_language=native,
        target_language=target,
        proficiency_level="A2",  # temporary default
        correction_tolerance=tolerance,
    )

    if test_choice == "yes":
        display.console.print(f"\n  Profile created for [bold cyan]{name}[/bold cyan]!")
        level_test.run_test(learner)
    else:
        level = Prompt.ask("  Current level", choices=["A1", "A2", "B1", "B2", "C1", "C2"], default="A2")
        conn = db._connect()
        conn.execute("UPDATE learners SET proficiency_level = ? WHERE id = ?", (level, learner["id"]))
        conn.commit()
        conn.close()
        learner["proficiency_level"] = level
        display.console.print(f"\n  Profile created for [bold cyan]{name}[/bold cyan]!\n")

    return learner


def _process_turn(user_input: str, learner: dict, session_id: str,
                   turn_number: int, audio_path: str | None = None) -> None:
    """Process a single conversation turn (shared by text and voice modes)."""
    result = tutor.chat(user_input, learner)
    response = result["response"]
    analysis = result["analysis"]

    # Display the response
    display.show_tutor_response(response)

    # Speak the response if TTS is enabled
    if config.TTS_ENGINE != "none":
        from voice.tts import speak
        speak(response, learner.get("target_language"))

    # Process analysis and update tracking
    correction_given = False
    correction_type = None
    correction_reasoning = None

    if analysis:
        correction_action = analysis.get("correction_action", "none")
        correction_given = correction_action in ("recast", "correct_explicitly")
        correction_type = correction_action
        correction_reasoning = analysis.get("correction_reasoning")

        analyzer.process_analysis(
            learner_id=learner["id"],
            session_id=session_id,
            analysis=analysis,
            user_message=user_input,
        )
    else:
        db.update_session_counters(session_id)

    # Store the turn
    db.create_turn(
        session_id=session_id,
        turn_number=turn_number,
        user_message=user_input,
        tutor_response=response,
        analysis_json=json.dumps(analysis) if analysis else None,
        correction_given=correction_given,
        correction_type=correction_type,
        correction_reasoning=correction_reasoning,
    )


def run_text_session(learner: dict, session_id: str, session_count: int) -> None:
    """Text-only conversation loop."""
    display.show_header(learner, session_count)
    turn_number = 0

    while True:
        user_input = display.prompt_input()
        if not user_input.strip():
            continue

        if user_input.strip().startswith("/"):
            should_quit = commands.handle_command(user_input.strip(), learner, session_id)
            if should_quit:
                break
            continue

        turn_number += 1
        _process_turn(user_input, learner, session_id, turn_number)


def run_voice_session(learner: dict, session_id: str, session_count: int) -> None:
    """Voice conversation loop — speak and listen."""
    from voice.audio import record_push_to_talk, check_microphone
    from voice.stt import transcribe
    from voice.tts import speak, is_available as tts_available

    if not check_microphone():
        display.show_error("No microphone detected. Falling back to text mode.")
        run_text_session(learner, session_id, session_count)
        return

    display.show_header(learner, session_count)
    display.console.print("  [bold green]Voice mode[/bold green] — Press [bold]Enter[/bold] to start recording,")
    display.console.print("  speak, then press [bold]Enter[/bold] again (or wait for silence).")
    display.console.print("  Type text directly to switch to text input for that turn.")
    display.console.print("  Say [bold]\"quit\"[/bold], [bold]\"끝\"[/bold], or [bold]\"종료\"[/bold] to end the session.")
    display.console.print("  Commands like /help still work.\n")

    turn_number = 0

    while True:
        try:
            action = display.console.input("[bold green]You > [/]").strip()
        except (EOFError, KeyboardInterrupt):
            break

        # Commands
        if action.startswith("/"):
            should_quit = commands.handle_command(action, learner, session_id)
            if should_quit:
                break
            continue

        # If they typed text, use it directly
        if action:
            turn_number += 1
            _process_turn(action, learner, session_id, turn_number)
            continue

        # Empty Enter = start voice recording
        display.console.print("  [dim]Recording... (press Enter or wait for silence to stop)[/dim]")

        audio_path = record_push_to_talk(
            silence_threshold=0.01,
            silence_duration=config.VAD_SILENCE_THRESHOLD,
        )

        if not audio_path:
            display.console.print("  [dim]No audio captured.[/dim]")
            continue

        # Transcribe
        display.console.print("  [dim]Transcribing...[/dim]")
        result = transcribe(audio_path)

        if result.get("error"):
            display.show_error(f"Transcription failed: {result['error']}")
            continue

        transcript = result.get("text", "").strip()
        if not transcript:
            display.console.print("  [dim]Couldn't understand audio. Try again or type your message.[/dim]")
            continue

        # Show what was heard
        display.console.print(f"  [italic]{transcript}[/italic]")

        # Check for voice quit commands
        quit_phrases = ["quit", "exit", "end session", "stop session", "그만", "끝", "종료"]
        if transcript.lower().strip().rstrip(".!") in quit_phrases:
            display.console.print("  [dim]Ending session...[/dim]")
            break

        turn_number += 1
        _process_turn(transcript, learner, session_id, turn_number, audio_path=audio_path)


def run_session(learner: dict) -> None:
    """Run a single conversation session."""
    session_count = db.get_session_count(learner["id"]) + 1
    session = db.create_session(learner["id"], mode=config.MODE)
    session_id = session["id"]

    tutor.reset_history()
    tutor.set_session_id(session_id)

    if config.MODE == "voice":
        run_voice_session(learner, session_id, session_count)
    else:
        run_text_session(learner, session_id, session_count)

    # End session
    session = db.end_session(session_id)
    display.show_session_summary(session)


def main() -> None:
    db.init_db()

    learner = db.get_learner()
    if not learner:
        learner = first_run_setup()

    display.console.print(f"\n  Welcome back, [bold cyan]{learner['name']}[/bold cyan]!")

    # Ask for mode
    mode = Prompt.ask("  Mode", choices=["text", "voice"], default=config.MODE)
    config.MODE = mode

    # Enable TTS in voice mode if not explicitly set
    if mode == "voice" and config.TTS_ENGINE == "none":
        config.TTS_ENGINE = "macos"

    display.console.print()

    try:
        run_session(learner)
    except KeyboardInterrupt:
        display.console.print("\n\n  Session interrupted.\n", style="dim")
        sys.exit(0)


if __name__ == "__main__":
    main()
