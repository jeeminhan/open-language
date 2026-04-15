# Prompt Test Suite

Two layers of tests for iterating on the tutor prompt (`prompts/system.txt`, shared with the dashboard).

## Unit tests (fast, free)

Mock the LLM client. Verify prompt wiring and response parsing.

```bash
cd cli
.venv/bin/pytest
```

## Evaluation suite (slow, calls real LLM)

Drives scenarios in `tests/evals/scenarios.yaml` through the real model and asserts output shape/language/analysis. Each run writes a per-scenario JSON artifact to `tests/evals/runs/<timestamp>/<scenario>.json` so you can diff prompt iterations.

```bash
cd cli
.venv/bin/pytest -m eval
```

### Iterating on prompts

1. Run the eval once and inspect `tests/evals/runs/<latest>/` to see `system_prompt`, `response`, `analysis`, and `raw`.
2. Edit `prompts/system.txt` (root — shared with dashboard).
3. Re-run. Diff old vs new run directories:
   ```bash
   diff -r tests/evals/runs/<old-ts> tests/evals/runs/<new-ts>
   ```
4. Add scenarios to `scenarios.yaml` as you discover regressions.

### Assertion types

| Type | Checks |
|---|---|
| `response_contains_any` | response text contains at least one listed string |
| `response_language` | response contains characters from the given script (`hiragana_or_katakana`, `hangul`) |
| `analysis_has_key` | analysis JSON is present and contains the given key |
| `analysis_errors_nonempty` | `analysis.errors` is a non-empty list |
