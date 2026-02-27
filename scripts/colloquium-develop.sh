#!/usr/bin/env bash
# =============================================================================
# colloquium-develop.sh
# Autonomous development loop for a Colloquium project.
#
# Architecture (from learn-claude-code s04 + s07):
#   - Each iteration spawns a FRESH claude process (messages=[])
#   - State lives in project-state.json — survives across processes
#   - Loop reads state between iterations (poll → claim → work → repeat)
#   - No plugins, no stop hooks. Just: while; do claude; done
#
# Usage:
#   ./scripts/colloquium-develop.sh <slug>
#   ./scripts/colloquium-develop.sh <slug> --max-iterations 50
#   ./scripts/colloquium-develop.sh <slug> --verbose
#
# Signals (written to .dev-signal by the skill):
#   BLOCKED: <reason>   → skill is stuck, needs human input
#   DONE                → all tests passing (bash also detects via state)
#
# Exit codes:
#   0 — all tests passing
#   1 — BLOCKED (human needed)
#   2 — max iterations reached
#   3 — prerequisite missing
#   130 — interrupted (Ctrl+C)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Guard: refuse if running inside an active Claude Code session.
# Claude detects nesting via IPC sockets — env -u CLAUDECODE is not enough.
# This script MUST be launched from a terminal outside any Claude session.
# ---------------------------------------------------------------------------
if [[ -n "${CLAUDECODE:-}" ]]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ERROR: running inside a Claude Code session                 ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  This script spawns fresh claude processes and cannot run    ║"
  echo "║  from inside an active Claude session (IPC socket conflict). ║"
  echo "║                                                              ║"
  echo "║  Fix: open a NEW terminal (Terminal.app / iTerm2) outside    ║"
  echo "║  VS Code, cd to the project root, and run:                   ║"
  echo "║                                                              ║"
  echo "║    ./scripts/colloquium-develop.sh <slug>                    ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  exit 3
fi

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
SLUG="${1:?Error: slug required. Usage: $0 <slug> [--max-iterations N] [--silent]}"
MAX_ITER=500
VERBOSE=true   # default: stream all claude output to terminal

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations) MAX_ITER="$2"; shift 2 ;;
    --silent)         VERBOSE=false; shift ;;
    *)                echo "Unknown option: $1"; exit 3 ;;
  esac
done

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
STATE_FILE=".claude/projects/${SLUG}/project-state.json"
FEATURE_LIST=".claude/projects/${SLUG}/feature_list.json"
SIGNAL_FILE=".claude/projects/${SLUG}/.dev-signal"
LOG_FILE=".claude/projects/${SLUG}/.dev-loop.log"
ACTIVE_FILE=".claude/projects/${SLUG}/.dev-loop.active"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
for cmd in jq claude; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found in PATH."
    [[ "$cmd" == "jq" ]] && echo "  Install: brew install jq"
    [[ "$cmd" == "claude" ]] && echo "  Install: npm install -g @anthropic-ai/claude-code"
    exit 3
  fi
done

if [[ ! -f "$STATE_FILE" ]]; then
  echo "Error: ${STATE_FILE} not found."
  echo "  Run /colloquium:project first to bootstrap the project."
  exit 3
fi

if [[ ! -f "$FEATURE_LIST" ]]; then
  echo "Error: ${FEATURE_LIST} not found."
  echo "  Run /colloquium:project first to bootstrap the project."
  exit 3
fi

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------
get_passing()  { jq -r '.passingTests  // 0'   "$STATE_FILE"; }
get_total()    { jq -r '.totalTests    // 200'  "$STATE_FILE"; }
get_index()    { jq -r '.currentTestIndex // 0' "$STATE_FILE"; }
get_desc() {
  local idx="${1:-$(get_index)}"
  jq -r --argjson i "$idx" '.[$i].description // "(unknown)"' "$FEATURE_LIST"
}

# ---------------------------------------------------------------------------
# Clean up previous run artifacts
# ---------------------------------------------------------------------------
rm -f "$SIGNAL_FILE" "$ACTIVE_FILE"

# ---------------------------------------------------------------------------
# Trap: clean exit on Ctrl+C or SIGTERM
# ---------------------------------------------------------------------------
cleanup() {
  local code=$?
  rm -f "$ACTIVE_FILE"
  echo ""
  local passing total index
  passing=$(get_passing)
  total=$(get_total)
  index=$(get_index)
  echo -e "${YELLOW}⏸  Loop interrupted${RESET}"
  echo -e "   Progress : ${passing}/${total} tests passing"
  echo -e "   Next test: #$((index + 1)) — $(get_desc "$index")"
  echo -e "   Resume   : $0 ${SLUG}"
  exit 130
}
trap cleanup SIGINT SIGTERM

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
PASSING=$(get_passing)
TOTAL=$(get_total)
INDEX=$(get_index)
NAME=$(jq -r '.name // "'${SLUG}'"' "$STATE_FILE")

echo ""
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}  COLLOQUIUM DEVELOP LOOP${RESET}${BOLD} — ${NAME}${RESET}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${RESET}"
echo -e "  Progress       : ${PASSING}/${TOTAL} tests passing"
echo -e "  Next test      : #$((INDEX + 1)) — $(get_desc "$INDEX")"
echo -e "  Max iterations : ${MAX_ITER}"
echo -e "  Output         : $(if $VERBOSE; then echo 'full (--silent to suppress)'; else echo "log only — tail -f ${LOG_FILE}"; fi)"
echo -e "  Interrupt      : Ctrl+C to pause"
echo -e "${CYAN}════════════════════════════════════════════════════════════${RESET}"
echo ""

# ---------------------------------------------------------------------------
# Main loop
# s11 pattern: poll → claim → work → repeat
# s04 principle: each claude invocation = fresh process = clean context
# s07 principle: project-state.json is the durable task board
# ---------------------------------------------------------------------------
for ((iter=1; iter<=MAX_ITER; iter++)); do

  # --- Read state fresh from disk (s07: state is the source of truth) ------
  PASSING=$(get_passing)
  TOTAL=$(get_total)
  INDEX=$(get_index)

  # --- Completion check -----------------------------------------------------
  if (( PASSING >= TOTAL )); then
    rm -f "$ACTIVE_FILE"
    echo ""
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
    echo -e "${GREEN}${BOLD}  🎉  PROJECT COMPLETE — ${NAME}${RESET}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${RESET}"
    echo -e "  All ${TOTAL}/${TOTAL} tests passing."
    echo -e "  Total iterations: ${iter}"
    echo -e "  Human handles merge / deployment."
    echo -e "${GREEN}════════════════════════════════════════════════════════════${RESET}"
    exit 0
  fi

  # --- BLOCKED check (skill writes this file when stuck) --------------------
  if [[ -f "$SIGNAL_FILE" ]]; then
    SIGNAL=$(cat "$SIGNAL_FILE")
    if [[ "$SIGNAL" == BLOCKED:* ]]; then
      rm -f "$ACTIVE_FILE"
      echo ""
      echo -e "${RED}${BOLD}════════════════════════════════════════════════════════════${RESET}"
      echo -e "${RED}${BOLD}  ⛔  BLOCKED — human intervention needed${RESET}"
      echo -e "${RED}════════════════════════════════════════════════════════════${RESET}"
      echo -e "  ${SIGNAL#BLOCKED: }"
      echo -e ""
      echo -e "  To resume after fixing:"
      echo -e "    rm ${SIGNAL_FILE}"
      echo -e "    $0 ${SLUG}"
      echo -e "${RED}════════════════════════════════════════════════════════════${RESET}"
      exit 1
    fi
  fi

  # --- Progress line --------------------------------------------------------
  DESC=$(get_desc "$INDEX")
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}▶ Iter ${iter}/${MAX_ITER}${RESET}  |  Test #$((INDEX + 1))/${TOTAL}  |  ${PASSING} passing"
  echo -e "  ${DESC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${RESET}"

  # --- Write .active marker (lets skill know it's in loop mode) ------------
  echo "$iter" > "$ACTIVE_FILE"

  # --- Log entry ------------------------------------------------------------
  {
    echo ""
    echo "=== Iteration ${iter} — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "State: test #$((INDEX + 1)), ${PASSING}/${TOTAL} passing"
    echo "Desc: ${DESC}"
  } >> "$LOG_FILE"

  # --- Run ONE fresh claude session (s04: fresh process = clean context) ---
  # --permission-mode bypassPermissions: auto-approve all tool calls so the
  # loop never pauses waiting for human input (Bash, Edit, Write, MCP tools).
  # Without this flag, claude pauses for permissions and the terminal appears frozen.
  #
  # Unset CLAUDECODE: Claude Code sets this env var to detect nested sessions and
  # refuses to start if it's present. We must clear it so each loop iteration can
  # spawn a fresh claude process from outside any parent session.
  CLAUDE_ARGS=(
    --print
    --permission-mode bypassPermissions
    "/colloquium:project ${SLUG} --loop"
  )

  if $VERBOSE; then
    # Stream claude output to terminal AND log simultaneously
    env -u CLAUDECODE claude "${CLAUDE_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
  else
    # Run claude in background; show an animated ticker so the terminal is
    # obviously alive.  Grab the last log line every 5s for context.
    env -u CLAUDECODE claude "${CLAUDE_ARGS[@]}" >> "$LOG_FILE" 2>&1 &
    CLAUDE_PID=$!
    ELAPSED=0
    SPINNER_CHARS=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    SPIN_IDX=0
    while kill -0 "$CLAUDE_PID" 2>/dev/null; do
      SPIN="${SPINNER_CHARS[$((SPIN_IDX % ${#SPINNER_CHARS[@]}))]}"
      LAST=$(tail -1 "$LOG_FILE" 2>/dev/null | cut -c1-55 || true)
      printf "\r  ${CYAN}%s${RESET} ${ELAPSED}s  %-55s" "$SPIN" "$LAST"
      sleep 1
      ELAPSED=$((ELAPSED + 1))
      SPIN_IDX=$((SPIN_IDX + 1))
    done
    printf "\r%*s\r" 80 ""   # clear the ticker line
    wait "$CLAUDE_PID" || true
    EXIT_CODE=$?
  fi

  rm -f "$ACTIVE_FILE"

  # --- Check what the iteration accomplished --------------------------------
  NEW_PASSING=$(get_passing)
  NEW_INDEX=$(get_index)

  if (( NEW_PASSING > PASSING )); then
    echo -e "  ${GREEN}✓ Test #$((INDEX + 1)) verified and passing → ${NEW_PASSING}/${TOTAL}${RESET}"
  elif (( NEW_INDEX > INDEX )); then
    echo -e "  ${YELLOW}→ Advanced to test #$((NEW_INDEX + 1)) (previous skipped or deferred)${RESET}"
  else
    if (( EXIT_CODE != 0 )); then
      echo -e "  ${YELLOW}⚠  No progress (claude exit: ${EXIT_CODE}) — will retry same test next iteration${RESET}"
    else
      echo -e "  ${YELLOW}⚠  No state change — may need another iteration to complete this test${RESET}"
    fi
    echo -e "     Details: tail -50 ${LOG_FILE}"
  fi

  echo ""

done

# ---------------------------------------------------------------------------
# Max iterations reached
# ---------------------------------------------------------------------------
rm -f "$ACTIVE_FILE"
PASSING=$(get_passing)
TOTAL=$(get_total)
echo -e "${YELLOW}⚠  Max iterations (${MAX_ITER}) reached.${RESET}"
echo -e "   Progress : ${PASSING}/${TOTAL} tests passing"
echo -e "   Resume   : $0 ${SLUG}"
exit 2
