#!/usr/bin/env bash
# scripts/verify.sh: the single quality gate. It runs: project state check → typecheck → lint → fast tests →
# fixture-sanitizer self-test.
#
#   Usage: scripts/verify.sh            run every step
#          scripts/verify.sh test -k x  run one step (state|typecheck|lint|test|sanitizer); extra args go to it
#
# Exit 0 = every configured step passed. If any step is unconfigured, it prints NOT VERIFIED
# (still exit 0 so early scaffolding isn't blocked). A task can't pass on a NOT VERIFIED run.
#
# To add or change a check: edit the matching step_* function. Keep steps fast; slow suites belong elsewhere.
# The stack is auto-detected from the project manifest (see detect_stack).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -t 1 ]]; then B=$'\e[1m' RED=$'\e[31m' GRN=$'\e[32m' YEL=$'\e[33m' BLU=$'\e[34m' RST=$'\e[0m'
else B='' RED='' GRN='' YEL='' BLU='' RST=''; fi
have() { command -v "$1" >/dev/null 2>&1; }

# ── stack detection ──────────────────────────────────────────────────────────
detect_stack() {
  if   [[ -f package.json ]]; then
    if   [[ -f pnpm-lock.yaml ]];           then echo pnpm
    elif [[ -f yarn.lock ]];                then echo yarn
    elif [[ -f bun.lock || -f bun.lockb ]]; then echo bun
    else                                         echo npm; fi
  elif [[ -f pyproject.toml ]]; then echo python
  elif [[ -f Cargo.toml ]];     then echo rust
  elif [[ -f go.mod ]];         then echo go
  else                               echo none; fi
}
STACK="$(detect_stack)"

SKIP=99  # sentinel return code: step not configured
js_has() { grep -Eq "\"$1\"[[:space:]]*:" package.json 2>/dev/null; }
js()     { local s="$1"; shift; js_has "$s" || return $SKIP; if (( $# )); then "$STACK" run "$s" -- "$@"; else "$STACK" run "$s"; fi; }
py()     { if have uv; then uv run "$@"; else python3 -m "$@"; fi; }

# ── steps ────────────────────────────────────────────────────────────────────
step_state() {  # private project state files are well-formed
  local f=.agent/tasks.json
  # .agent/ is private and isn't in the public repo. Skipping prints
  # NOT VERIFIED, so a development checkout that lost it can't pass a task by accident.
  [[ -d .agent ]] || { echo "no .agent/ here (public checkout): skipped"; return $SKIP; }
  [[ -f "$f" ]] || { echo "$f missing"; return 1; }
  if have jq; then
    jq -e '.tasks | type == "array" and all(.[]; has("id") and has("status") and (.passes | type == "boolean"))' "$f" >/dev/null \
      || { echo "$f: every task needs id, status, and boolean passes"; return 1; }
    local dupes; dupes="$(jq -r '[.tasks[].id] | group_by(.) | map(select(length > 1) | .[0]) | join(", ")' "$f")"
    [[ -z "$dupes" ]] || { echo "$f: duplicate ids: $dupes"; return 1; }
  else
    python3 -c 'import json,sys; t=json.load(open(sys.argv[1]))["tasks"]; ids=[x["id"] for x in t]; \
assert all(isinstance(x.get("passes"),bool) and "status" in x for x in t), "every task needs id, status, boolean passes"; \
assert len(ids)==len(set(ids)), "duplicate ids"' "$f" || return 1
  fi
  [[ -f .agent/progress.md ]] || { echo ".agent/progress.md missing"; return 1; }
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
     && [[ "$(git config core.hooksPath || true)" != ".githooks" && -z "${CI:-}" ]]; then
    printf '%s! git hooks not installed. Run scripts/install-hooks.sh%s\n' "$YEL" "$RST"
  fi
}

step_typecheck() {
  case "$STACK" in
    npm|pnpm|yarn|bun) js typecheck "$@" ;;
    python) py mypy src "$@" ;;
    rust)   cargo check --all-targets --quiet "$@" ;;
    go)     go build ./... ;;
    *)      return $SKIP ;;
  esac
}

step_lint() {
  case "$STACK" in
    npm|pnpm|yarn|bun) js lint "$@" ;;
    python) py ruff check . "$@" && py ruff format --check . ;;
    rust)   cargo clippy --all-targets --quiet -- -D warnings && cargo fmt --check ;;
    go)     go vet ./... && test -z "$(gofmt -l .)" ;;
    *)      return $SKIP ;;
  esac
}

step_test() {  # fast tests only
  case "$STACK" in
    npm|pnpm|yarn|bun) js test "$@" ;;
    python) py pytest -q -m "not slow" "$@" ;;
    rust)   cargo test --quiet "$@" ;;
    go)     go test -short ./... "$@" ;;
    *)      return $SKIP ;;
  esac
}

step_sanitizer() {  # scripts/sanitize-fixture.py: sample input → expected output, default and --strip-text modes
  have python3 || return $SKIP
  local dir=tests/sanitize-fixture tmp rc=0; tmp="$(mktemp -d)"
  local redact=(--redact "Jane Doe" --redact Jane --redact Doe)
  python3 -I scripts/sanitize-fixture.py "$dir/input.html" "$tmp/default.html" "${redact[@]}" >/dev/null \
    && diff -u "$dir/expected.html" "$tmp/default.html" || rc=1
  python3 -I scripts/sanitize-fixture.py "$dir/input.html" "$tmp/strip.html" "${redact[@]}" \
      --strip-text --keep-text "Suggested for you" --keep-text Shorts --keep-text Like >/dev/null \
    && diff -u "$dir/expected-strip.html" "$tmp/strip.html" || rc=1
  # Google API keys are scrubbed. The key is assembled here so no key-shaped string is ever committed.
  local key="AIza""Sy0000000000000000000000000000000AB"
  printf '<div data-api="%s"></div>\n' "$key" >"$tmp/key.html"
  python3 -I scripts/sanitize-fixture.py "$tmp/key.html" "$tmp/key.out.html" >/dev/null
  if grep -q "$key" "$tmp/key.out.html" || ! grep -q 'data-api="REDACTED_API_KEY"' "$tmp/key.out.html"; then
    echo "sanitizer: Google API key was not scrubbed"; rc=1
  fi
  rm -rf "$tmp"; return $rc
}

# ── runner ───────────────────────────────────────────────────────────────────
FAILED=() SKIPPED=()
run() {
  local name="$1"; shift
  printf '%s==>%s %s\n' "$BLU" "$RST" "$name"
  "step_$name" "$@"; local rc=$?
  if   [[ $rc -eq 0 ]];     then printf '%s✔ %s%s\n' "$GRN" "$name" "$RST"
  elif [[ $rc -eq $SKIP ]]; then printf '%s- %s: not configured for stack "%s"%s\n' "$YEL" "$name" "$STACK" "$RST"; SKIPPED+=("$name")
  else                           printf '%s✘ %s (exit %d)%s\n' "$RED" "$name" "$rc" "$RST"; FAILED+=("$name"); fi
}

if [[ $# -gt 0 ]]; then
  declare -F "step_$1" >/dev/null || { echo "unknown step '$1' (state|typecheck|lint|test|sanitizer)" >&2; exit 2; }
  run "$@"
else
  for s in state typecheck lint test sanitizer; do run "$s"; done
fi

echo
if   [[ ${#FAILED[@]}  -gt 0 ]]; then printf '%s%sFAILED:%s %s\n' "$B" "$RED" "$RST" "${FAILED[*]}"; exit 1
elif [[ ${#SKIPPED[@]} -gt 0 ]]; then printf '%s%sNOT VERIFIED:%s skipped %s (stack: %s)\n' "$B" "$YEL" "$RST" "${SKIPPED[*]}" "$STACK"; exit 0
else                                  printf '%s%sPASSED%s\n' "$B" "$GRN" "$RST"; fi
