# Python Agent Monorepo Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `autonomous-coding/` and `colloquium-loop/` with a single UV-managed `agents/` Python package exposing `develop` and `generate` modes via `python -m colloquium_agent`.

**Architecture:** Single UV project under `agents/` with zero runtime deps (stdlib only). `runner.py` is the shared core that spawns `claude --print` as a subprocess and streams output. `develop.py` wraps the iterative test-passing loop; `generate.py` is a one-shot invocation. `cli.py` wires both into a clean argparse interface.

**Tech Stack:** Python 3.11+, UV (project management), pytest (dev dep for tests), stdlib only at runtime.

---

## Task 0: Create git worktree

This work should be isolated from the main workspace.

**Step 1: Create worktree**

```bash
git worktree add .claude/worktrees/python-agent -b feat/python-agent
```

**Step 2: Verify**

```bash
git worktree list
```

Expected: shows the new worktree at `.claude/worktrees/python-agent`.

**Step 3: Open new Claude Code session in the worktree**

All subsequent tasks run from `.claude/worktrees/python-agent/`.

---

## Task 1: Initialize UV project structure

**Files:**

- Create: `agents/pyproject.toml`
- Create: `agents/src/colloquium_agent/__init__.py`
- Create: `agents/tests/__init__.py`
- Create: `agents/tests/conftest.py`

**Step 1: Create the directory skeleton**

```bash
mkdir -p agents/src/colloquium_agent agents/tests
```

**Step 2: Write `agents/pyproject.toml`**

```toml
[project]
name = "colloquium-agent"
version = "0.1.0"
description = "Autonomous Claude CLI agent for Colloquium — develop and generate modes"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
colloquium-agent = "colloquium_agent.__main__:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/colloquium_agent"]

[tool.uv]
dev-dependencies = ["pytest>=8.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Step 3: Write `agents/src/colloquium_agent/__init__.py`**

```python
"""Colloquium autonomous Claude CLI agent."""

__version__ = "0.1.0"
```

**Step 4: Write `agents/tests/__init__.py`**

Empty file.

**Step 5: Write `agents/tests/conftest.py`**

```python
"""Shared pytest fixtures."""
import json
from pathlib import Path
import pytest


@pytest.fixture
def tmp_project(tmp_path: Path) -> Path:
    """Create a minimal project state directory for testing."""
    proj_dir = tmp_path / ".claude" / "projects" / "test-project"
    proj_dir.mkdir(parents=True)

    state = {
        "name": "Test Project",
        "passingTests": 3,
        "totalTests": 10,
        "currentTestIndex": 3,
    }
    (proj_dir / "project-state.json").write_text(json.dumps(state))

    features = [
        {"description": f"Feature {i}", "passes": i < 3}
        for i in range(10)
    ]
    (proj_dir / "feature_list.json").write_text(json.dumps(features))

    return tmp_path
```

**Step 6: Initialise UV and install dev deps**

```bash
cd agents && uv sync
```

Expected: creates `.venv/` and `uv.lock`.

**Step 7: Verify pytest is reachable**

```bash
cd agents && uv run pytest --collect-only
```

Expected: `no tests ran` (nothing written yet) — no errors.

**Step 8: Commit**

```bash
git add agents/
git commit -m "feat(agents): initialise UV project skeleton"
```

---

## Task 2: Write `runner.py`

The single shared function that both modes use to spawn `claude --print`.

**Files:**

- Create: `agents/src/colloquium_agent/runner.py`
- Create: `agents/tests/test_runner.py`
- Create: `agents/tests/fake_claude.py` (test helper)

**Step 1: Write the failing tests first**

`agents/tests/test_runner.py`:

```python
"""Tests for runner.py — the subprocess core."""
import os
import sys
from pathlib import Path
import pytest

from colloquium_agent.runner import run_claude


FAKE_CLAUDE = Path(__file__).parent / "fake_claude.py"


def test_run_claude_returns_zero_on_success(tmp_path: Path) -> None:
    """run_claude returns 0 when the subprocess exits cleanly."""
    exit_code = run_claude(
        prompt="hello",
        cwd=tmp_path,
        claude_bin=[sys.executable, str(FAKE_CLAUDE), "--exit", "0"],
    )
    assert exit_code == 0


def test_run_claude_returns_nonzero_on_failure(tmp_path: Path) -> None:
    """run_claude propagates non-zero exit codes."""
    exit_code = run_claude(
        prompt="hello",
        cwd=tmp_path,
        claude_bin=[sys.executable, str(FAKE_CLAUDE), "--exit", "1"],
    )
    assert exit_code == 1


def test_run_claude_strips_claudecode_env(tmp_path: Path, monkeypatch) -> None:
    """CLAUDECODE is removed from child process environment."""
    monkeypatch.setenv("CLAUDECODE", "1")
    # fake_claude prints env vars it receives; we capture via its exit-on-claudecode flag
    exit_code = run_claude(
        prompt="hello",
        cwd=tmp_path,
        claude_bin=[sys.executable, str(FAKE_CLAUDE), "--check-no-claudecode"],
    )
    # fake_claude exits 0 if CLAUDECODE is absent, 42 if present
    assert exit_code == 0


def test_run_claude_streams_output(tmp_path: Path, capsys) -> None:
    """Output from the subprocess is written to stdout in real time."""
    run_claude(
        prompt="hello",
        cwd=tmp_path,
        claude_bin=[sys.executable, str(FAKE_CLAUDE), "--echo", "line-one"],
    )
    captured = capsys.readouterr()
    assert "line-one" in captured.out
```

**Step 2: Write the fake claude test helper**

`agents/tests/fake_claude.py`:

```python
#!/usr/bin/env python3
"""
Fake claude binary for tests.

Flags:
  --exit N               Exit with code N
  --echo TEXT            Print TEXT to stdout then exit 0
  --check-no-claudecode  Exit 0 if CLAUDECODE not in env, else exit 42
"""
import argparse
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exit", type=int, default=0, dest="exit_code")
    parser.add_argument("--echo", default=None)
    parser.add_argument("--check-no-claudecode", action="store_true")
    args = parser.parse_args()

    if args.check_no_claudecode:
        sys.exit(42 if "CLAUDECODE" in os.environ else 0)

    if args.echo:
        print(args.echo, flush=True)

    sys.exit(args.exit_code)


if __name__ == "__main__":
    main()
```

**Step 3: Run tests — verify they fail**

```bash
cd agents && uv run pytest tests/test_runner.py -v
```

Expected: `ImportError: cannot import name 'run_claude' from 'colloquium_agent.runner'`

**Step 4: Write `agents/src/colloquium_agent/runner.py`**

```python
"""
runner.py
---------
Core subprocess runner. Spawns the claude CLI binary and streams its
stdout to the terminal line-by-line.

Both develop.py and generate.py use run_claude() — nothing else.
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Optional


# Default claude binary invocation.
# Tests override this with a fake binary via the claude_bin parameter.
_DEFAULT_CLAUDE_BIN = ["claude"]


def run_claude(
    prompt: str,
    cwd: Path,
    *,
    permission_mode: str = "bypassPermissions",
    claude_bin: Optional[list[str]] = None,
) -> int:
    """
    Spawn the claude CLI binary and stream its stdout to the terminal.

    Args:
        prompt:          The prompt / slash-command string to pass as the
                         final CLI argument.
        cwd:             Working directory for the subprocess.
        permission_mode: Value passed to --permission-mode (default:
                         bypassPermissions).
        claude_bin:      Override the binary invocation (used in tests to
                         point at a fake claude script).

    Returns:
        The subprocess exit code (0 = success, non-zero = error).

    Why CLAUDECODE is stripped
    --------------------------
    Claude Code sets CLAUDECODE=1 so nested sessions can be detected.
    Removing it from the child environment lets this runner spawn fresh
    claude processes even when the parent shell has CLAUDECODE set.
    Note: running *inside* an active Claude Code session via the Bash
    tool will still fail — Claude detects that via IPC sockets we cannot
    clear. Always run from an external terminal.
    """
    env = os.environ.copy()
    env.pop("CLAUDECODE", None)

    bin_args = claude_bin if claude_bin is not None else _DEFAULT_CLAUDE_BIN

    cmd = [
        *bin_args,
        "--print",
        "--permission-mode", permission_mode,
        prompt,
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,   # merge stderr so nothing is hidden
        text=True,
        env=env,
        cwd=str(cwd),
        bufsize=1,                  # line-buffered on our read side
    )

    for line in iter(proc.stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()

    proc.stdout.close()
    proc.wait()
    return proc.returncode
```

**Step 5: Run tests — verify they pass**

```bash
cd agents && uv run pytest tests/test_runner.py -v
```

Expected: 4 PASSED.

**Step 6: Commit**

```bash
git add agents/src/colloquium_agent/runner.py agents/tests/test_runner.py agents/tests/fake_claude.py
git commit -m "feat(agents): add runner.py subprocess core with tests"
```

---

## Task 3: Write `develop.py`

The iterative development loop.

**Files:**

- Create: `agents/src/colloquium_agent/develop.py`
- Create: `agents/tests/test_develop.py`

**Step 1: Write the failing tests**

`agents/tests/test_develop.py`:

```python
"""Tests for develop.py state-reading and loop control logic."""
import json
import sys
from pathlib import Path
import pytest

from colloquium_agent.develop import (
    read_state,
    read_feature,
    is_complete,
    check_blocked,
    format_progress,
)


def test_read_state_returns_dict(tmp_project: Path) -> None:
    state_file = tmp_project / ".claude" / "projects" / "test-project" / "project-state.json"
    state = read_state(state_file)
    assert state["passingTests"] == 3
    assert state["totalTests"] == 10


def test_read_feature_in_range(tmp_project: Path) -> None:
    feature_file = tmp_project / ".claude" / "projects" / "test-project" / "feature_list.json"
    feat = read_feature(feature_file, 0)
    assert feat["description"] == "Feature 0"


def test_read_feature_out_of_range(tmp_project: Path) -> None:
    feature_file = tmp_project / ".claude" / "projects" / "test-project" / "feature_list.json"
    feat = read_feature(feature_file, 999)
    assert feat["description"] == "(past end of feature list)"


def test_is_complete_true_when_passing_equals_total() -> None:
    state = {"passingTests": 10, "totalTests": 10}
    assert is_complete(state) is True


def test_is_complete_false_when_not_done() -> None:
    state = {"passingTests": 3, "totalTests": 10}
    assert is_complete(state) is False


def test_check_blocked_returns_none_when_no_signal(tmp_path: Path) -> None:
    signal_file = tmp_path / ".dev-signal"
    assert check_blocked(signal_file) is None


def test_check_blocked_returns_reason_when_blocked(tmp_path: Path) -> None:
    signal_file = tmp_path / ".dev-signal"
    signal_file.write_text("BLOCKED: missing migration file")
    reason = check_blocked(signal_file)
    assert reason == "missing migration file"


def test_check_blocked_ignores_non_blocked_signal(tmp_path: Path) -> None:
    signal_file = tmp_path / ".dev-signal"
    signal_file.write_text("some other signal content")
    assert check_blocked(signal_file) is None


def test_format_progress() -> None:
    state = {"passingTests": 3, "totalTests": 10, "currentTestIndex": 3}
    text = format_progress(state)
    assert "3/10" in text
```

**Step 2: Run tests — verify they fail**

```bash
cd agents && uv run pytest tests/test_develop.py -v
```

Expected: `ImportError: cannot import name 'read_state' from 'colloquium_agent.develop'`

**Step 3: Write `agents/src/colloquium_agent/develop.py`**

```python
"""
develop.py
----------
Autonomous development loop. Reads project state from disk each iteration
(never caches in memory), spawns claude --print with the project skill,
and repeats until all tests pass or a BLOCKED signal is written.

Usage (via cli.py / __main__.py):
    python -m colloquium_agent develop <slug>
    python -m colloquium_agent develop <slug> --max-iterations 10
"""

import json
import os
import signal
import sys
import time
from pathlib import Path
from typing import Optional

from colloquium_agent.runner import run_claude


# ── ANSI colours (disabled when stdout is not a TTY) ──────────────────────────

def _colours() -> dict:
    if not sys.stdout.isatty():
        return {k: "" for k in ("cyan", "green", "yellow", "red", "bold", "reset")}
    return {
        "cyan":   "\033[0;36m",
        "green":  "\033[0;32m",
        "yellow": "\033[1;33m",
        "red":    "\033[0;31m",
        "bold":   "\033[1m",
        "reset":  "\033[0m",
    }


C = _colours()
BAR = "═" * 62


# ── Pure state helpers (tested in isolation) ──────────────────────────────────

def read_state(state_file: Path) -> dict:
    """Read project-state.json from disk. Always fresh — never cached."""
    return json.loads(state_file.read_text())


def read_feature(feature_file: Path, index: int) -> dict:
    """Return the feature dict at `index`, or a sentinel past end-of-list."""
    features = json.loads(feature_file.read_text())
    if 0 <= index < len(features):
        return features[index]
    return {"description": "(past end of feature list)", "passes": True}


def is_complete(state: dict) -> bool:
    """Return True when passingTests >= totalTests."""
    return state.get("passingTests", 0) >= state.get("totalTests", 1)


def check_blocked(signal_file: Path) -> Optional[str]:
    """
    Return the reason string if .dev-signal contains a BLOCKED: message,
    otherwise return None.
    """
    if not signal_file.exists():
        return None
    text = signal_file.read_text().strip()
    if text.startswith("BLOCKED:"):
        return text[len("BLOCKED:"):].strip()
    return None


def format_progress(state: dict) -> str:
    """Return a one-line progress summary."""
    passing = state.get("passingTests", 0)
    total   = state.get("totalTests", 0)
    index   = state.get("currentTestIndex", 0)
    return f"{passing}/{total} passing | next test: #{index + 1}"


# ── Display helpers ───────────────────────────────────────────────────────────

def _banner(text: str, colour: str = "cyan") -> None:
    col, rst = C[colour], C["reset"]
    print(f"\n{col}{BAR}{rst}")
    print(f"{col}  {text}{rst}")
    print(f"{col}{BAR}{rst}")


def _iter_header(iteration: int, max_iter: int, state: dict, desc: str) -> None:
    passing = state.get("passingTests", 0)
    total   = state.get("totalTests", 0)
    index   = state.get("currentTestIndex", 0)
    col, rst = C["cyan"], C["reset"]
    print(f"\n{col}{BAR}{rst}")
    print(f"{col}▶ Iter {iteration}/{max_iter}{rst}"
          f"  |  Test #{index + 1}/{total}"
          f"  |  {passing} passing")
    print(f"  {desc}")
    print(f"{col}{BAR}{rst}\n")


# ── Main entry point ──────────────────────────────────────────────────────────

def run_develop_loop(
    slug: str,
    project_root: Path,
    max_iterations: int = 500,
    *,
    claude_bin: Optional[list] = None,
) -> None:
    """
    Run the autonomous development loop for `slug`.

    Args:
        slug:           Project slug matching .claude/projects/<slug>/
        project_root:   Monorepo root (contains .claude/).
        max_iterations: Stop after this many iterations.
        claude_bin:     Override claude binary (used in integration tests).
    """
    # ── Guard: refuse if launched from inside Claude Code ─────────────────────
    if os.environ.get("CLAUDECODE"):
        print()
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║  ERROR: running inside a Claude Code session                 ║")
        print("║                                                               ║")
        print("║  Open a NEW terminal and run:                                ║")
        print(f"║    python -m colloquium_agent develop {slug:<27}║")
        print("╚══════════════════════════════════════════════════════════════╝")
        sys.exit(1)

    proj_dir    = project_root / ".claude" / "projects" / slug
    state_file  = proj_dir / "project-state.json"
    feature_file= proj_dir / "feature_list.json"
    signal_file = proj_dir / ".dev-signal"
    active_file = proj_dir / ".dev-loop.active"

    # ── Prerequisites ─────────────────────────────────────────────────────────
    for path, label in [(state_file, "project-state.json"),
                        (feature_file, "feature_list.json")]:
        if not path.exists():
            print(f"Error: {path} not found.")
            print(f"  Run /colloquium:project first to bootstrap '{slug}'.")
            sys.exit(1)

    # ── Clean previous run artifacts ──────────────────────────────────────────
    signal_file.unlink(missing_ok=True)
    active_file.unlink(missing_ok=True)

    # ── Startup banner ────────────────────────────────────────────────────────
    state = read_state(state_file)
    name  = state.get("name", slug)
    _banner(f"COLLOQUIUM DEVELOP LOOP — {name}")
    print(f"  Project root  : {project_root}")
    print(f"  Progress      : {format_progress(state)}")
    print(f"  Max iterations: {max_iterations}")
    print(f"  Interrupt     : Ctrl+C to pause and show resume command")
    print()

    # ── Signal handler (Ctrl+C) ───────────────────────────────────────────────
    interrupted = False

    def _on_sigint(sig, frame):
        nonlocal interrupted
        interrupted = True

    signal.signal(signal.SIGINT, _on_sigint)

    # ── Main loop ─────────────────────────────────────────────────────────────
    for iteration in range(1, max_iterations + 1):
        if interrupted:
            break

        state   = read_state(state_file)
        passing = state.get("passingTests", 0)
        index   = state.get("currentTestIndex", 0)

        # Completion
        if is_complete(state):
            active_file.unlink(missing_ok=True)
            total = state.get("totalTests", 0)
            _banner(f"PROJECT COMPLETE — {name}", "green")
            print(f"  All {total}/{total} tests passing.")
            print(f"  Total iterations: {iteration - 1}")
            sys.exit(0)

        # Blocked
        reason = check_blocked(signal_file)
        if reason:
            active_file.unlink(missing_ok=True)
            _banner("BLOCKED — human intervention needed", "red")
            print(f"  {reason}")
            print()
            print(f"  After fixing:")
            print(f"    rm {signal_file}")
            print(f"    python -m colloquium_agent develop {slug}")
            sys.exit(1)

        feat = read_feature(feature_file, index)
        desc = feat.get("description", "(unknown)")
        _iter_header(iteration, max_iterations, state, desc)

        active_file.write_text(str(iteration))
        exit_code = run_claude(
            prompt=f"/colloquium:project {slug} --loop",
            cwd=project_root,
            claude_bin=claude_bin,
        )
        active_file.unlink(missing_ok=True)

        # Progress delta
        new_state   = read_state(state_file)
        new_passing = new_state.get("passingTests", 0)
        new_index   = new_state.get("currentTestIndex", 0)

        if new_passing > passing:
            print(f"\n  {C['green']}✓ Test #{index + 1} verified"
                  f" → {new_passing}/{new_state.get('totalTests', 0)} passing{C['reset']}")
        elif new_index > index:
            print(f"\n  {C['yellow']}→ Advanced to test #{new_index + 1}"
                  f" (previous skipped/deferred){C['reset']}")
        elif exit_code != 0:
            print(f"\n  {C['yellow']}⚠  claude exited {exit_code}"
                  f" — will retry same test next iteration{C['reset']}")
        else:
            print(f"\n  {C['yellow']}⚠  No state change"
                  f" — another iteration needed{C['reset']}")

        print()
        time.sleep(1)

    # ── Interrupted or max iterations ─────────────────────────────────────────
    active_file.unlink(missing_ok=True)
    state   = read_state(state_file)
    index   = state.get("currentTestIndex", 0)
    feat    = read_feature(feature_file, index)

    if interrupted:
        print(f"\n{C['yellow']}⏸  Loop paused.{C['reset']}")
    else:
        print(f"\n{C['yellow']}⚠  Max iterations ({max_iterations}) reached.{C['reset']}")

    print(f"   Progress : {format_progress(state)}")
    print(f"   Next test: #{index + 1} — {feat.get('description', '')}")
    print(f"   Resume   : python -m colloquium_agent develop {slug}")
    print()
    sys.exit(2 if not interrupted else 130)
```

**Step 4: Run tests — verify they pass**

```bash
cd agents && uv run pytest tests/test_develop.py -v
```

Expected: 9 PASSED.

**Step 5: Commit**

```bash
git add agents/src/colloquium_agent/develop.py agents/tests/test_develop.py
git commit -m "feat(agents): add develop.py loop with state helpers and tests"
```

---

## Task 4: Write `generate.py`

One-shot code generation from a spec file or inline prompt.

**Files:**

- Create: `agents/src/colloquium_agent/generate.py`
- Create: `agents/tests/test_generate.py`

**Step 1: Write the failing tests**

`agents/tests/test_generate.py`:

```python
"""Tests for generate.py prompt building logic."""
from pathlib import Path
import pytest

from colloquium_agent.generate import build_prompt


def test_build_prompt_from_inline_prompt() -> None:
    prompt = build_prompt(prompt="create a Hono route for POST /api/messages")
    assert "POST /api/messages" in prompt


def test_build_prompt_from_spec_file(tmp_path: Path) -> None:
    spec = tmp_path / "spec.md"
    spec.write_text("# My Spec\nBuild a login page.")
    prompt = build_prompt(spec=spec)
    assert "Build a login page." in prompt


def test_build_prompt_with_output_dir(tmp_path: Path) -> None:
    prompt = build_prompt(
        prompt="create a component",
        output_dir=tmp_path / "apps" / "colloquium-chat",
    )
    assert str(tmp_path / "apps" / "colloquium-chat") in prompt


def test_build_prompt_raises_if_neither_spec_nor_prompt() -> None:
    with pytest.raises(ValueError, match="provide either"):
        build_prompt()


def test_build_prompt_raises_if_both_spec_and_prompt(tmp_path: Path) -> None:
    spec = tmp_path / "spec.md"
    spec.write_text("content")
    with pytest.raises(ValueError, match="not both"):
        build_prompt(spec=spec, prompt="also this")
```

**Step 2: Run tests — verify they fail**

```bash
cd agents && uv run pytest tests/test_generate.py -v
```

Expected: `ImportError`

**Step 3: Write `agents/src/colloquium_agent/generate.py`**

```python
"""
generate.py
-----------
One-shot code generation mode. Builds a prompt from a spec file or an
inline string, then invokes runner.run_claude once and exits.

Usage (via cli.py / __main__.py):
    python -m colloquium_agent generate --spec docs/spec.md
    python -m colloquium_agent generate --prompt "create a Hono route..."
    python -m colloquium_agent generate --spec docs/spec.md --output-dir apps/chat
"""

import sys
from pathlib import Path
from typing import Optional

from colloquium_agent.runner import run_claude


def build_prompt(
    *,
    spec: Optional[Path] = None,
    prompt: Optional[str] = None,
    output_dir: Optional[Path] = None,
) -> str:
    """
    Build the final prompt string from a spec file or inline prompt.

    Args:
        spec:       Path to a markdown spec file.
        prompt:     Inline prompt string.
        output_dir: Optional output directory hint included in the prompt.

    Returns:
        The final prompt string to pass to run_claude.

    Raises:
        ValueError: If neither or both of spec/prompt are provided.
    """
    if spec is None and prompt is None:
        raise ValueError("provide either --spec or --prompt")
    if spec is not None and prompt is not None:
        raise ValueError("provide --spec or --prompt, not both")

    if spec is not None:
        content = spec.read_text()
        base = f"Read the following spec and implement it exactly as described:\n\n{content}"
    else:
        base = prompt  # type: ignore[assignment]

    if output_dir is not None:
        base = f"{base}\n\nOutput files should be placed under: {output_dir}"

    return base


def run_generate(
    *,
    spec: Optional[Path] = None,
    prompt: Optional[str] = None,
    output_dir: Optional[Path] = None,
    project_root: Path,
    claude_bin: Optional[list] = None,
) -> None:
    """
    Run a single one-shot generation invocation.

    Args:
        spec:         Path to spec file (mutually exclusive with prompt).
        prompt:       Inline prompt string (mutually exclusive with spec).
        output_dir:   Hint for where generated files should go.
        project_root: Monorepo root (cwd for the claude subprocess).
        claude_bin:   Override claude binary (used in tests).
    """
    final_prompt = build_prompt(spec=spec, prompt=prompt, output_dir=output_dir)

    print(f"Generating from {'spec: ' + str(spec) if spec else 'prompt'}...")
    print()

    exit_code = run_claude(
        prompt=final_prompt,
        cwd=project_root,
        claude_bin=claude_bin,
    )

    sys.exit(exit_code)
```

**Step 4: Run tests — verify they pass**

```bash
cd agents && uv run pytest tests/test_generate.py -v
```

Expected: 5 PASSED.

**Step 5: Commit**

```bash
git add agents/src/colloquium_agent/generate.py agents/tests/test_generate.py
git commit -m "feat(agents): add generate.py one-shot mode with prompt builder and tests"
```

---

## Task 5: Write `cli.py` and `__main__.py`

The argparse wiring and entry point bootstrap.

**Files:**

- Create: `agents/src/colloquium_agent/cli.py`
- Create: `agents/src/colloquium_agent/__main__.py`
- Create: `agents/tests/test_cli.py`

**Step 1: Write the failing tests**

`agents/tests/test_cli.py`:

```python
"""Tests for cli.py argument parsing."""
import pytest
from colloquium_agent.cli import build_parser


def test_develop_subcommand_parses_slug() -> None:
    parser = build_parser()
    args = parser.parse_args(["develop", "colloquium-chat"])
    assert args.subcommand == "develop"
    assert args.slug == "colloquium-chat"


def test_develop_default_max_iterations() -> None:
    parser = build_parser()
    args = parser.parse_args(["develop", "colloquium-chat"])
    assert args.max_iterations == 500


def test_develop_custom_max_iterations() -> None:
    parser = build_parser()
    args = parser.parse_args(["develop", "colloquium-chat", "--max-iterations", "10"])
    assert args.max_iterations == 10


def test_generate_with_prompt() -> None:
    parser = build_parser()
    args = parser.parse_args(["generate", "--prompt", "create a route"])
    assert args.subcommand == "generate"
    assert args.prompt == "create a route"
    assert args.spec is None


def test_generate_with_spec() -> None:
    parser = build_parser()
    args = parser.parse_args(["generate", "--spec", "docs/spec.md"])
    assert args.subcommand == "generate"
    assert str(args.spec) == "docs/spec.md"
    assert args.prompt is None


def test_generate_with_output_dir() -> None:
    parser = build_parser()
    args = parser.parse_args(["generate", "--prompt", "x", "--output-dir", "apps/chat"])
    assert str(args.output_dir) == "apps/chat"


def test_no_subcommand_prints_help(capsys) -> None:
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args([])
```

**Step 2: Run tests — verify they fail**

```bash
cd agents && uv run pytest tests/test_cli.py -v
```

Expected: `ImportError`

**Step 3: Write `agents/src/colloquium_agent/cli.py`**

```python
"""
cli.py
------
argparse wiring for the colloquium-agent CLI.

Subcommands:
    develop <slug>  [--max-iterations N] [--project-root PATH]
    generate        --spec PATH | --prompt STRING [--output-dir PATH]
"""

import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="colloquium-agent",
        description="Autonomous Claude CLI agent — develop and generate modes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m colloquium_agent develop colloquium-chat
  python -m colloquium_agent develop colloquium-chat --max-iterations 10
  python -m colloquium_agent generate --spec docs/spec.md
  python -m colloquium_agent generate --prompt "create a Hono route for POST /api/messages"

IMPORTANT: Must be run from a terminal OUTSIDE any active Claude Code session.
        """,
    )
    parser.add_argument(
        "--version",
        action="version",
        version="colloquium-agent 0.1.0",
    )

    sub = parser.add_subparsers(dest="subcommand", metavar="<subcommand>")
    sub.required = True

    # ── develop ───────────────────────────────────────────────────────────────
    dev = sub.add_parser(
        "develop",
        help="Autonomous test-by-test implementation loop",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    dev.add_argument(
        "slug",
        help="Project slug matching .claude/projects/<slug>/",
    )
    dev.add_argument(
        "--max-iterations",
        type=int,
        default=500,
        metavar="N",
        help="Stop after N iterations (default: 500)",
    )
    dev.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Path to the monorepo root (default: current directory)",
    )

    # ── generate ──────────────────────────────────────────────────────────────
    gen = sub.add_parser(
        "generate",
        help="One-shot code generation from a spec or prompt",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    src = gen.add_mutually_exclusive_group(required=True)
    src.add_argument(
        "--spec",
        type=Path,
        metavar="PATH",
        help="Path to a markdown spec file",
    )
    src.add_argument(
        "--prompt",
        metavar="STRING",
        help="Inline prompt string",
    )
    gen.add_argument(
        "--output-dir",
        type=Path,
        metavar="PATH",
        help="Hint for where generated files should go",
    )
    gen.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Path to the monorepo root (default: current directory)",
    )

    return parser
```

**Step 4: Write `agents/src/colloquium_agent/__main__.py`**

```python
"""
__main__.py
-----------
Entry point bootstrap. Thin: parse args, dispatch to develop or generate.

    python -m colloquium_agent develop colloquium-chat
    python -m colloquium_agent generate --spec docs/spec.md
"""

from pathlib import Path
from colloquium_agent.cli import build_parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.subcommand == "develop":
        from colloquium_agent.develop import run_develop_loop
        run_develop_loop(
            slug=args.slug,
            project_root=args.project_root.resolve(),
            max_iterations=args.max_iterations,
        )

    elif args.subcommand == "generate":
        from colloquium_agent.generate import run_generate
        run_generate(
            spec=args.spec,
            prompt=args.prompt,
            output_dir=getattr(args, "output_dir", None),
            project_root=args.project_root.resolve(),
        )


if __name__ == "__main__":
    main()
```

**Step 5: Run all tests**

```bash
cd agents && uv run pytest -v
```

Expected: all tests PASSED.

**Step 6: Smoke-test the CLI help**

```bash
cd agents && uv run python -m colloquium_agent --help
uv run python -m colloquium_agent develop --help
uv run python -m colloquium_agent generate --help
```

Expected: clean help text, no errors.

**Step 7: Commit**

```bash
git add agents/src/colloquium_agent/cli.py agents/src/colloquium_agent/__main__.py agents/tests/test_cli.py
git commit -m "feat(agents): add cli.py + __main__.py entry point with tests"
```

---

## Task 6: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add the Python Agent section after the Verification Commands section**

Find the `## Verification Commands` section and add after it:

````markdown
## Python Agent (`agents/`)

The `agents/` package is a UV-managed Python project that drives Claude autonomously via the `claude` CLI binary (subprocess — no Anthropic API key required).

**Setup (one time):**

```bash
cd agents && uv sync
```
````

**Entry point:**

```bash
# Develop mode — iterate test-by-test until all tests pass
python -m colloquium_agent develop <slug>
python -m colloquium_agent develop colloquium-chat --max-iterations 10

# Generate mode — one-shot code generation from spec or prompt
python -m colloquium_agent generate --spec docs/spec.md
python -m colloquium_agent generate --prompt "create a Hono route for POST /api/messages"
```

**Critical constraint:** Must be run from a terminal **outside** any active Claude Code session. Claude detects nested sessions via IPC sockets — removing env vars is not sufficient.

**State files** for develop mode live in `.claude/projects/<slug>/`. Bootstrap a project with `/colloquium:project <slug>` before running the loop.

**Zero runtime deps** — stdlib only. `uv sync` only installs pytest for tests.

````

**Step 2: Run a quick sanity check**

```bash
grep -n "Python Agent" CLAUDE.md
````

Expected: finds the new section.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): document Python agent setup and usage"
```

---

## Task 7: Delete old directories and final verification

**Step 1: Delete `autonomous-coding/`**

```bash
git rm -r autonomous-coding/
```

**Step 2: Delete `colloquium-loop/`**

```bash
git rm -r colloquium-loop/
```

**Step 3: Run the full test suite one last time**

```bash
cd agents && uv run pytest -v
```

Expected: all tests PASSED.

**Step 4: Verify the CLI entry point still works**

```bash
cd agents && uv run python -m colloquium_agent --version
```

Expected: `colloquium-agent 0.1.0`

**Step 5: Run TS checks to confirm nothing is broken**

```bash
cd .. && pnpm turbo typecheck
```

Expected: no errors (Python changes don't affect TS).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(agents): remove autonomous-coding/ and colloquium-loop/ — superseded by agents/"
```

---

## Task 8: Merge / PR

```bash
git push -u origin feat/python-agent
```

Then open a PR into `main` (or merge directly if working alone).
