# Python Agent Monorepo Integration — Design

**Date:** 2026-02-24
**Status:** Approved
**Branch:** feat/python-agent-monorepo

## Problem

Two exploratory Python directories exist (`autonomous-coding/`, `colloquium-loop/`) with overlapping but inconsistent approaches to running Claude autonomously. Neither is a proper package, neither has clean entry points, and they use different strategies (SDK vs CLI subprocess). They need to be replaced with a single, well-structured Python agent package.

## Decision

Replace both directories with a single UV-managed Python package at `agents/`. The package wraps the `claude` CLI binary via subprocess (no Anthropic API key, no SDK dependency) and exposes two modes: `develop` and `generate`.

## Architecture

### Directory structure

```
Colloquium/
├── agents/
│   ├── pyproject.toml              # UV project (name: colloquium-agent)
│   ├── uv.lock
│   └── src/
│       └── colloquium_agent/
│           ├── __init__.py
│           ├── __main__.py         # python -m colloquium_agent
│           ├── cli.py              # argparse: develop | generate subcommands
│           ├── runner.py           # core subprocess runner
│           ├── develop.py          # develop mode loop
│           └── generate.py         # generate mode (one-shot)
├── apps/                           # unchanged TS
├── packages/                       # unchanged TS
├── pnpm-workspace.yaml             # unchanged
└── turbo.json                      # unchanged
```

### Entry points

```bash
# Setup (one time)
cd agents && uv sync

# Develop mode — autonomous test-by-test implementation loop
python -m colloquium_agent develop colloquium-chat
python -m colloquium_agent develop colloquium-chat --max-iterations 10
python -m colloquium_agent develop colloquium-chat --project-root ~/Work/Colloquium

# Generate mode — one-shot code generation from spec or prompt
python -m colloquium_agent generate --spec docs/spec.md
python -m colloquium_agent generate --prompt "create a Hono route for POST /api/messages"
python -m colloquium_agent generate --spec docs/spec.md --output-dir apps/colloquium-chat
```

## Module responsibilities

### `runner.py` — subprocess core

The single shared function used by both modes:

```python
def run_claude(prompt: str, cwd: Path, *, permission_mode: str = "bypassPermissions") -> int:
    """Spawn claude --print, stream stdout line-by-line, return exit code."""
```

- Strips `CLAUDECODE` from env (prevents nested session detection)
- Streams stdout line-by-line to terminal in real time
- Returns exit code

### `develop.py` — develop mode

Autonomous development loop. Reads state from disk each iteration (never caches in memory).

```
while not complete:
    read .claude/projects/<slug>/project-state.json
    check passingTests >= totalTests  → done, exit 0
    check .dev-signal for BLOCKED:    → print reason, exit 1
    spawn: claude --print --permission-mode bypassPermissions "/colloquium:project <slug> --loop"
    re-read state, print progress delta
    sleep 1
```

Signal file protocol (preserved from colloquium-loop):

- `.dev-loop.active` — written each iteration with iteration number, deleted after
- `.dev-signal` — written by Claude if BLOCKED, triggers human intervention
- Both files live in `.claude/projects/<slug>/`

Ctrl+C handling: catches SIGINT, finishes current iteration cleanly, prints resume command.

Guard: refuses to start if `CLAUDECODE` env var is set (running inside Claude Code session).

### `generate.py` — generate mode

One-shot generation. Builds a prompt from `--spec` or `--prompt`, invokes `runner.run_claude` once, streams output, exits.

### `cli.py` + `__main__.py` — entry point wiring

argparse subcommands:

```
colloquium-agent develop <slug>
  --max-iterations N    (default: 500)
  --project-root PATH   (default: cwd)

colloquium-agent generate
  --spec PATH           (mutually exclusive with --prompt)
  --prompt STRING
  --output-dir PATH     (optional, passed to Claude in the prompt)
```

## Python tooling

- **UV** — project management, venv, lockfile
- **Python >= 3.11**
- **Zero runtime dependencies** — stdlib only
- `pyproject.toml` declares `[project.scripts] colloquium-agent = "colloquium_agent.__main__:main"`

## Monorepo integration

### What is deleted

- `autonomous-coding/` — SDK-based approach, replaced
- `colloquium-loop/` — CLI subprocess approach, superseded

### What is unchanged

- All TypeScript `apps/` and `packages/`
- `turbo.json`, `pnpm-workspace.yaml`
- `.claude/` projects, state files, skills

### CLAUDE.md addition

New section documenting the Python agent, setup command, and the constraint that it must be run outside an active Claude Code session.

### Optional Turbo task

```json
"agent:develop": { "cache": false, "persistent": true }
```

Surfaces `pnpm turbo agent:develop` as a convenience alias. Turbo does not orchestrate Python — it just passes through to `uv run`.

## Constraints

- Must be run from a terminal **outside** any active Claude Code session (Claude detects nested sessions via IPC sockets, not just env vars)
- State files (`.claude/projects/<slug>/project-state.json`, `feature_list.json`) must exist before running develop mode — bootstrap via `/colloquium:project` first
- `claude` CLI must be installed and authenticated on the host machine
