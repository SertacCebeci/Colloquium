#!/usr/bin/env python3
"""
colloquium-loop/loop.py
=======================
Long-running autonomous development loop for Colloquium projects.

Key design principle: uses the `claude` CLI binary directly (subprocess),
NOT the Claude SDK or Anthropic API. Each iteration spawns a completely
fresh `claude --print` process so context never accumulates — you get the
same fresh-mind clarity you'd get opening a new Claude Code window.

Architecture
------------
  while True:
      read state from disk (project-state.json)
      check completion / BLOCKED signal
      spawn: claude --print /colloquium:project <slug> --loop
      stream stdout line-by-line to your terminal in real time
      re-read state to see what changed
      loop

Usage
-----
  # From a terminal OUTSIDE Claude Code (Terminal.app / iTerm2):
  cd /path/to/Colloquium
  python colloquium-loop/loop.py colloquium-chat

  # Limit iterations
  python colloquium-loop/loop.py colloquium-chat --max-iterations 10

  # Run silently (background process + spinner ticker, output logged to file)
  python colloquium-loop/loop.py colloquium-chat --silent

  # Choose a specific Claude model
  python colloquium-loop/loop.py colloquium-chat --model sonnet

  # Point at a different monorepo root
  python colloquium-loop/loop.py colloquium-chat --project-root /path/to/repo

  # Show current project state and exit (no loop)
  python colloquium-loop/loop.py colloquium-chat --status

Dependencies
------------
  None — stdlib only. Python 3.8+.
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path


# ─── ANSI colours (disabled when stdout is not a TTY) ─────────────────────────

def _colour_fns() -> dict:
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

C = _colour_fns()


# ─── State helpers ─────────────────────────────────────────────────────────────

def read_state(state_file: Path) -> dict:
    """Read project-state.json from disk (always fresh — never cached)."""
    return json.loads(state_file.read_text())


def read_feature(feature_file: Path, index: int) -> dict:
    """Return the feature dict at `index` from feature_list.json."""
    features = json.loads(feature_file.read_text())
    if 0 <= index < len(features):
        return features[index]
    return {"description": "(past end of feature list)", "passes": True}


# ─── Display helpers ───────────────────────────────────────────────────────────

BAR = "═" * 62

def banner(text: str, colour_key: str = "cyan") -> None:
    col = C[colour_key]
    rst = C["reset"]
    print(f"\n{col}{BAR}{rst}")
    print(f"{col}  {text}{rst}")
    print(f"{col}{BAR}{rst}")


def iter_header(iteration: int, max_iter: int, index: int, total: int,
                passing: int, desc: str) -> None:
    col = C["cyan"]
    rst = C["reset"]
    print(f"\n{col}{BAR}{rst}")
    print(f"{col}▶ Iter {iteration}/{max_iter}{rst}"
          f"  |  Test #{index + 1}/{total}"
          f"  |  {passing} passing")
    print(f"  {desc}")
    print(f"{col}{BAR}{rst}\n")


# ─── Claude subprocess ─────────────────────────────────────────────────────────

def run_claude(slug: str, project_root: Path, log_file: Path | None,
               model: str | None, silent: bool) -> int:
    """
    Spawn a fresh `claude --print` process and stream its stdout.

    In verbose mode (default): streams live to the terminal.
    In silent mode (--silent):  writes to log_file and shows a spinner ticker.

    Returns the process exit code (0 = clean exit, non-zero = error).

    Why we strip CLAUDECODE from the environment
    --------------------------------------------
    Claude Code sets CLAUDECODE=1 to detect when it is already running and
    refuse to start a nested session.  Removing the variable from the child's
    environment lets this script safely spawn fresh claude processes even when
    the script itself was launched from a shell that has CLAUDECODE set.

    NOTE: this still will NOT work if you run the script FROM INSIDE an active
    Claude Code session via the Bash tool — Claude detects that via IPC sockets
    that we cannot clear.  Run this from an external terminal.
    """
    env = os.environ.copy()
    env.pop("CLAUDECODE", None)

    cmd = [
        "claude",
        "--print",
        "--permission-mode", "bypassPermissions",
    ]
    if model:
        cmd += ["--model", model]
    cmd.append(f"/colloquium:project {slug} --loop")

    if not silent:
        # ── Verbose mode: stream directly to terminal ──────────────────────────
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            cwd=str(project_root),
            bufsize=1,
        )
        for line in iter(proc.stdout.readline, ""):
            sys.stdout.write(line)
            sys.stdout.flush()
            if log_file:
                with open(log_file, "a") as f:
                    f.write(line)
        proc.stdout.close()
        proc.wait()
        return proc.returncode

    # ── Silent mode: background process + spinner ticker ──────────────────────
    assert log_file is not None, "log_file required in silent mode"
    with open(log_file, "a") as lf:
        proc = subprocess.Popen(
            cmd,
            stdout=lf,
            stderr=subprocess.STDOUT,
            env=env,
            cwd=str(project_root),
        )

    spinner_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    elapsed = 0
    spin_idx = 0
    done = threading.Event()

    def _spinner():
        nonlocal elapsed, spin_idx
        while not done.is_set():
            spin = spinner_chars[spin_idx % len(spinner_chars)]
            try:
                last = log_file.read_text().splitlines()[-1][:55] if log_file.exists() else ""
            except (IndexError, OSError):
                last = ""
            line = f"\r  {C['cyan']}{spin}{C['reset']} {elapsed}s  {last:<55}"
            sys.stdout.write(line)
            sys.stdout.flush()
            time.sleep(1)
            elapsed += 1
            spin_idx += 1

    t = threading.Thread(target=_spinner, daemon=True)
    t.start()
    proc.wait()
    done.set()
    t.join(timeout=2)
    sys.stdout.write("\r" + " " * 80 + "\r")  # clear spinner line
    sys.stdout.flush()
    return proc.returncode


# ─── Status command ────────────────────────────────────────────────────────────

def show_status(slug: str, state_file: Path, feature_file: Path,
                log_file: Path, active_file: Path, signal_file: Path) -> None:
    """Print current project state and exit."""
    state   = read_state(state_file)
    name    = state.get("name", slug)
    passing = state.get("passingTests", 0)
    total   = state.get("totalTests", 200)
    index   = state.get("currentTestIndex", 0)
    updated = state.get("lastUpdated", "unknown")
    sessions= state.get("sessionCount", 0)
    feat    = read_feature(feature_file, index)

    col  = C["cyan"]
    grn  = C["green"]
    yel  = C["yellow"]
    red  = C["red"]
    rst  = C["reset"]

    print(f"\n{col}{BAR}{rst}")
    print(f"{col}  STATUS — {name}{rst}")
    print(f"{col}{BAR}{rst}")
    print(f"  Progress    : {passing}/{total} tests passing")
    print(f"  Next test   : #{index + 1} — {feat.get('description', '(unknown)')}")
    print(f"  Sessions    : {sessions}")
    print(f"  Last updated: {updated}")

    if active_file.exists():
        iter_num = active_file.read_text().strip()
        print(f"  Loop active : {yel}YES (iteration {iter_num}){rst}")
    else:
        print(f"  Loop active : no")

    if signal_file.exists():
        sig = signal_file.read_text().strip()
        if sig.startswith("BLOCKED:"):
            print(f"  Signal      : {red}BLOCKED — {sig[len('BLOCKED:'):].strip()}{rst}")
        else:
            print(f"  Signal      : {yel}{sig}{rst}")
    else:
        print(f"  Signal      : none")

    if log_file.exists():
        size = log_file.stat().st_size
        print(f"  Log file    : {log_file}  ({size} bytes)")
        print(f"  Tail log    : tail -f {log_file}")

    print(f"{col}{BAR}{rst}\n")


# ─── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Colloquium autonomous dev loop — uses claude CLI, not SDK",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python colloquium-loop/loop.py colloquium-chat
  python colloquium-loop/loop.py colloquium-chat --max-iterations 5
  python colloquium-loop/loop.py colloquium-chat --silent
  python colloquium-loop/loop.py colloquium-chat --model sonnet
  python colloquium-loop/loop.py colloquium-chat --status
  python colloquium-loop/loop.py colloquium-chat --project-root ~/Work/Colloquium

IMPORTANT: Run from a terminal outside any active Claude Code session.
        """,
    )
    parser.add_argument(
        "slug",
        help="Project slug matching .claude/projects/<slug>/",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Path to the Colloquium monorepo root (default: current directory)",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=500,
        metavar="N",
        help="Stop after N iterations (default: 500)",
    )
    parser.add_argument(
        "--silent",
        action="store_true",
        help="Run claude in background; show a spinner ticker. Output goes to .dev-loop.log",
    )
    parser.add_argument(
        "--model",
        metavar="MODEL",
        help="Claude model to use (e.g. sonnet, opus, claude-sonnet-4-6). Default: claude's own default",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print current project state and exit without running the loop",
    )
    args = parser.parse_args()

    slug        = args.slug
    root        = args.project_root.resolve()
    proj_dir    = root / ".claude" / "projects" / slug
    state_file  = proj_dir / "project-state.json"
    feature_file= proj_dir / "feature_list.json"
    signal_file = proj_dir / ".dev-signal"
    active_file = proj_dir / ".dev-loop.active"
    log_file    = proj_dir / ".dev-loop.log"

    # ── Prerequisites ─────────────────────────────────────────────────────────
    for path, label in [(state_file, "project-state.json"),
                        (feature_file, "feature_list.json")]:
        if not path.exists():
            print(f"Error: {path} not found.")
            print(f"  Run /colloquium:project first to bootstrap '{slug}'.")
            sys.exit(1)

    # ── Status-only mode (safe inside Claude Code — no subprocess spawned) ────
    if args.status:
        show_status(slug, state_file, feature_file, log_file, active_file, signal_file)
        sys.exit(0)

    # ── Guard: refuse if launched from inside Claude Code ─────────────────────
    if os.environ.get("CLAUDECODE"):
        print()
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║  ERROR: running inside a Claude Code session                 ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print("║  Claude detects nested sessions via IPC sockets.             ║")
        print("║  Removing CLAUDECODE from env is not sufficient.             ║")
        print("║                                                               ║")
        print("║  Open a NEW terminal (Terminal.app / iTerm2) and run:        ║")
        print("║    python colloquium-loop/loop.py " + slug.ljust(27) + " ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        print()
        sys.exit(1)

    # ── Clean previous run artifacts ──────────────────────────────────────────
    signal_file.unlink(missing_ok=True)
    active_file.unlink(missing_ok=True)

    # ── Startup banner ────────────────────────────────────────────────────────
    state   = read_state(state_file)
    name    = state.get("name", slug)
    passing = state.get("passingTests", 0)
    total   = state.get("totalTests", 200)
    index   = state.get("currentTestIndex", 0)

    banner(f"COLLOQUIUM DEVELOP LOOP — {name}")
    print(f"  Project root  : {root}")
    print(f"  Progress      : {passing}/{total} tests passing")
    print(f"  Next test     : #{index + 1} — {read_feature(feature_file, index).get('description', '')}")
    print(f"  Max iterations: {args.max_iterations}")
    if args.model:
        print(f"  Model         : {args.model}")
    if args.silent:
        print(f"  Output        : silent (tail -f {log_file})")
    else:
        print(f"  Output        : streaming")
    print(f"  Interrupt     : Ctrl+C to pause and show resume command")
    print()

    # ── Signal handler (Ctrl+C) ───────────────────────────────────────────────
    interrupted = False

    def _on_sigint(sig, frame):
        nonlocal interrupted
        interrupted = True

    signal.signal(signal.SIGINT, _on_sigint)

    # ── Main loop ─────────────────────────────────────────────────────────────
    for iteration in range(1, args.max_iterations + 1):

        if interrupted:
            break

        # Always re-read state from disk before each iteration.
        # This is the s07 principle: the JSON file is the source of truth,
        # not anything held in memory.
        state   = read_state(state_file)
        passing = state.get("passingTests", 0)
        total   = state.get("totalTests", 200)
        index   = state.get("currentTestIndex", 0)

        # ── Completion check ──────────────────────────────────────────────────
        if passing >= total:
            active_file.unlink(missing_ok=True)
            banner(f"🎉  PROJECT COMPLETE — {name}", "green")
            print(f"  All {total}/{total} tests passing.")
            print(f"  Total iterations: {iteration - 1}")
            print(f"  Human handles merge / deployment.")
            print()
            sys.exit(0)

        # ── BLOCKED check ─────────────────────────────────────────────────────
        if signal_file.exists():
            sig_text = signal_file.read_text().strip()
            if sig_text.startswith("BLOCKED:"):
                active_file.unlink(missing_ok=True)
                banner("⛔  BLOCKED — human intervention needed", "red")
                reason = sig_text[len("BLOCKED:"):].strip()
                print(f"  {reason}")
                print()
                print(f"  After fixing:")
                print(f"    rm {signal_file}")
                print(f"    python colloquium-loop/loop.py {slug}")
                print()
                sys.exit(1)

        # ── Iteration header ──────────────────────────────────────────────────
        feat = read_feature(feature_file, index)
        desc = feat.get("description", "(unknown)")
        iter_header(iteration, args.max_iterations, index, total, passing, desc)

        # Mark loop as active (skill reads this to know it's in loop mode)
        active_file.write_text(str(iteration))

        # Log entry
        with open(log_file, "a") as lf:
            lf.write(f"\n=== Iteration {iteration} — {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} ===\n")
            lf.write(f"State: test #{index + 1}, {passing}/{total} passing\n")
            lf.write(f"Desc: {desc}\n")

        # ── Spawn claude ──────────────────────────────────────────────────────
        exit_code = run_claude(
            slug, root,
            log_file=log_file,
            model=args.model,
            silent=args.silent,
        )

        active_file.unlink(missing_ok=True)

        # ── Post-iteration summary ────────────────────────────────────────────
        new_state   = read_state(state_file)
        new_passing = new_state.get("passingTests", 0)
        new_index   = new_state.get("currentTestIndex", 0)

        if new_passing > passing:
            print(f"\n  {C['green']}✓ Test #{index + 1} verified"
                  f" → {new_passing}/{total} passing{C['reset']}")
        elif new_index > index:
            print(f"\n  {C['yellow']}→ Advanced to test #{new_index + 1}"
                  f" (previous skipped/deferred){C['reset']}")
        elif exit_code != 0:
            print(f"\n  {C['yellow']}⚠  claude exited {exit_code}"
                  f" — will retry same test next iteration{C['reset']}")
        else:
            print(f"\n  {C['yellow']}⚠  No state change"
                  f" — another iteration needed for this test{C['reset']}")

        if args.silent:
            print(f"     Details: tail -50 {log_file}")
        print()

    # ── Interrupted or max iterations ─────────────────────────────────────────
    active_file.unlink(missing_ok=True)
    state   = read_state(state_file)
    passing = state.get("passingTests", 0)
    total   = state.get("totalTests", 200)
    index   = state.get("currentTestIndex", 0)

    if interrupted:
        print(f"\n{C['yellow']}⏸  Loop paused.{C['reset']}")
    else:
        print(f"\n{C['yellow']}⚠  Max iterations ({args.max_iterations}) reached.{C['reset']}")

    print(f"   Progress : {passing}/{total} tests passing")
    print(f"   Next test: #{index + 1} — {read_feature(feature_file, index).get('description', '')}")
    resume_cmd = f"python colloquium-loop/loop.py {slug}"
    if args.model:
        resume_cmd += f" --model {args.model}"
    if args.silent:
        resume_cmd += " --silent"
    print(f"   Resume   : {resume_cmd}")
    print()
    sys.exit(2 if not interrupted else 130)


if __name__ == "__main__":
    main()
