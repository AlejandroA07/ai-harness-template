#!/bin/bash
# audit-harness.sh — read-only self-audit of the whole harness (machine + 3 projects
# + template). Enforces mechanically what the docs claim. Never modifies anything.
#
# Usage: ./audit-harness.sh        exit 0 = no FAILs (WARNs allowed), 1 = FAILs found.
# Born 2026-07-15 from the external harness review: every check here corresponds to
# a real finding that prose alone did not prevent.
set -uo pipefail
cd "$(dirname "$0")"

REPOS=("$HOME/alfred" "$HOME/car-dealer" "$HOME/solo-master" "$HOME/vibehopper")
FAILS=0; WARNS=0
pass() { echo "[PASS] $*"; }
fail() { echo "[FAIL] $*"; FAILS=$((FAILS+1)); }
warn() { echo "[WARN] $*"; WARNS=$((WARNS+1)); }
info() { echo "[info] $*"; }

echo "== global =="

for d in "$HOME/.claude" "$HOME/.codex" "$HOME/.agents"; do
  [ -d "$d" ] || { warn "$d missing"; continue; }
  perm=$(stat -f "%Lp" "$d")
  [ "$perm" = "700" ] && pass "$d is 700" || fail "$d is $perm (want 700 — transcripts/state are private data)"
done

leaky=$(find "$HOME/.codex" -maxdepth 1 -type f -perm +044 2>/dev/null | wc -l | tr -d ' ')
if [ "$leaky" = "0" ]; then
  pass "~/.codex top-level files owner-only"
elif [ "$(stat -f %Lp "$HOME/.codex")" = "700" ]; then
  info "~/.codex: $leaky files are 644 but the 700 directory is the boundary (Codex recreates state files with default umask — accepted exception, unreachable from other accounts)"
else
  fail "~/.codex: $leaky group/world-readable files AND the directory is traversable"
fi
leaky=$(find "$HOME/.claude/projects" -type f -perm +044 2>/dev/null | wc -l | tr -d ' ')
[ "$leaky" = "0" ] && pass "~/.claude/projects files owner-only" || warn "~/.claude/projects has $leaky group/world-readable files"

command -v gitleaks >/dev/null && pass "gitleaks installed ($(gitleaks version 2>/dev/null | head -1))" || fail "gitleaks not installed"

python3 - "$HOME/.claude/settings.json" <<'PY' && pass "global Claude settings: denies + bypass lockout intact" || fail "global Claude settings: missing deny or bypass lockout"
import json, sys
d = json.load(open(sys.argv[1]))
deny = d.get("permissions", {}).get("deny", [])
ok = "Bash(git commit:*)" in deny and "Bash(git push:*)" in deny
lockout = d.get("permissions", {}).get("disableBypassPermissionsMode") or d.get("disableBypassPermissionsMode")
ok = ok and lockout == "disable"
sys.exit(0 if ok else 1)
PY

grep -q "guard-git-publish.sh" "$HOME/.codex/config.toml" 2>/dev/null \
  && pass "global Codex publish guard wired in ~/.codex/config.toml" \
  || fail "global Codex publish guard missing from ~/.codex/config.toml"
# a wired guard in a config that fails to LOAD is a dead guard (learned 2026-07-15:
# duplicate [features] table -> whole config invalid -> hooks silently off)
codex_toml_parses() {
  python3 - "$HOME/.codex/config.toml" <<'PY'
import sys
p = sys.argv[1]
try:
    import tomllib
    tomllib.load(open(p, "rb"))          # full parse; duplicate tables raise
    sys.exit(0)
except ImportError:
    pass                                  # py<3.11: fall through to duplicate scan
except Exception:
    sys.exit(1)
import re, collections
s = open(p).read()
tables = re.findall(r"^\[([^\[\]]+)\]$", s, re.M)
sys.exit(1 if [t for t, c in collections.Counter(tables).items() if c > 1] else 0)
PY
}
codex_cfg="checked"
if command -v codex >/dev/null 2>&1; then
  # inspect ONLY checks.config.load.status — overall doctor exit also fails on
  # unrelated TERM/connectivity/auth checks (false negative seen 2026-07-15)
  # Doctor can return non-zero for unrelated checks while still emitting valid
  # JSON, so capture its output independently and let the config parser decide.
  doctor_json="$(codex --strict-config doctor --json 2>/dev/null || true)"
  printf '%s' "$doctor_json" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(2)
st = d.get("checks", {}).get("config.load", {}).get("status")
sys.exit(0 if st == "ok" else 1)
'
  case $? in
    0) pass "codex doctor: config loads (checks.config.load ok)" ;;
    1) fail "codex doctor: config does NOT load — hooks are dead" ;;
    *) codex_cfg="fallback" ;;   # no/unparseable JSON -> static parse below
  esac
else
  codex_cfg="fallback"
fi
if [ "$codex_cfg" = "fallback" ]; then
  codex_toml_parses \
    && pass "codex config.toml parses (static check; codex doctor JSON unavailable)" \
    || fail "codex config.toml does NOT parse — config will not load, hooks dead"
fi
[ -x "$HOME/.codex/hooks/guard-git-publish.sh" ] && pass "guard script present+executable" || fail "~/.codex/hooks/guard-git-publish.sh missing or not executable"

[ -f "$HOME/.codex/AGENTS.md" ] && pass "~/.codex/AGENTS.md present (Codex global prefs)" || fail "~/.codex/AGENTS.md missing"

n=0; bad=0
for l in "$HOME/.agents/skills"/*; do
  [ -e "$l" ] || continue; n=$((n+1))
  [ -f "$l/SKILL.md" ] || { bad=$((bad+1)); info "  broken: $l"; }
done
[ "$n" -gt 0 ] && [ "$bad" = "0" ] && pass "~/.agents/skills: $n links, all resolve" || fail "~/.agents/skills: $n links, $bad broken (or none present)"

echo "== template repo =="
tpl="."
[ "$(git -C "$tpl" config core.hooksPath)" = ".githooks" ] && [ -x "$tpl/.githooks/pre-commit" ] \
  && pass "template: gitleaks pre-commit armed" || fail "template: pre-commit hook not armed (hooksPath or missing/exec bit)"
[ -f "$tpl/.github/workflows/secret-scan.yml" ] && pass "template: secret-scan CI present" || fail "template: secret-scan workflow missing"
grep -q "@latest" "$tpl/project/.mcp.json" && fail "template .mcp.json still uses @latest" || pass "template .mcp.json pinned"
grep -q '"ask": \["Bash"\]' "$tpl/project/.claude/harness-mode.sh" && pass "template harness-mode MANUAL has ask rule" || fail "template harness-mode MANUAL missing ask rule"

for repo in "${REPOS[@]}"; do
  name=$(basename "$repo")
  echo "== $name =="
  [ -d "$repo/.git" ] || { fail "$name: not found/not a repo"; continue; }

  # 1. local-only AI paths invisible to git
  for p2 in AGENTS.md CLAUDE.md .claude .mcp.json .agents .githooks docs; do
    [ -e "$repo/$p2" ] || continue
    git -C "$repo" check-ignore -q "$p2" && pass "$name: $p2 excluded" || fail "$name: $p2 NOT git-excluded"
  done
  tracked=$(git -C "$repo" ls-files | grep -cE '(^|/)(AGENTS\.md|CLAUDE\.md)$|^\.claude/|^\.mcp\.json$|^\.agents/' || true)
  [ "$tracked" = "0" ] && pass "$name: no tracked AI-signature paths" || fail "$name: $tracked AI-signature paths ARE tracked"

  # 2. hooks + scanner
  [ "$(git -C "$repo" config core.hooksPath)" = ".githooks" ] && pass "$name: core.hooksPath=.githooks" || fail "$name: core.hooksPath not set (per-clone! re-set after any fresh clone)"
  [ -x "$repo/.githooks/pre-commit" ] && pass "$name: pre-commit hook executable" || fail "$name: pre-commit hook missing/not executable"

  # 3. settings sanity + MANUAL contract
  for f in settings.json settings.local.json; do
    [ -f "$repo/.claude/$f" ] || continue
    python3 -c "import json;json.load(open('$repo/.claude/$f'))" 2>/dev/null && pass "$name: $f parses" || fail "$name: $f invalid JSON"
  done
  python3 - "$repo" <<'PY' && pass "$name: stable settings.json — allow empty, git denies present" || fail "$name: stable settings.json violates MANUAL contract (allow not empty, or git denies missing)"
import json, sys
d = json.load(open(sys.argv[1] + "/.claude/settings.json"))
p = d.get("permissions", {})
deny = p.get("deny", [])
sys.exit(0 if p.get("allow") == [] and "Bash(git commit:*)" in deny and "Bash(git push:*)" in deny else 1)
PY
  grep -q '"ask": \["Bash"\]' "$repo/.claude/harness-mode.sh" 2>/dev/null && pass "$name: MANUAL mode has literal-visibility ask rule" || fail "$name: harness-mode.sh MANUAL missing ask rule"

  # 4. switch states (informational; owner-controlled)
  mode=$("$repo/.claude/harness-mode.sh" status 2>/dev/null || echo "unknown")
  auto=$("$repo/.claude/git-autonomy.sh" status 2>/dev/null | head -1 || echo "unknown")
  info "$name: $mode | git-autonomy: $auto"
  echo "$auto" | grep -qi "off\|unknown" || warn "$name: git autonomy is RAISED — intentional?"

  # 5. Codex skill bridge
  if [ -d "$repo/.agents/skills" ] && [ ! -L "$repo/.agents/skills" ]; then
    bad=0; n=0
    for l in "$repo/.agents/skills"/*; do [ -e "$l" ] || continue; n=$((n+1)); [ -f "$l/SKILL.md" ] || bad=$((bad+1)); done
    [ "$n" -gt 0 ] && [ "$bad" = "0" ] && pass "$name: .agents/skills $n links resolve" || fail "$name: .agents/skills broken links ($bad/$n)"
  else
    fail "$name: .agents/skills missing or is itself a symlink (Codex discovery bug openai/codex#11314)"
  fi

  # 6. MCP pinning
  if [ -f "$repo/.mcp.json" ]; then
    grep -q "@latest" "$repo/.mcp.json" && fail "$name: .mcp.json uses @latest" || pass "$name: MCP versions pinned"
  fi

  # 7. shell syntax of all harness scripts
  synbad=0
  while IFS= read -r sh; do bash -n "$sh" 2>/dev/null || { synbad=$((synbad+1)); info "  syntax: $sh"; }; done \
    < <(find "$repo/.claude" "$repo/.harness" -name '*.sh' -type f 2>/dev/null)
  [ "$synbad" = "0" ] && pass "$name: harness scripts syntax OK" || fail "$name: $synbad scripts fail bash -n"

  # 8. snapshot freshness vs this repo's backup
  if [ -d "projects/$name" ]; then
    drift=$(rsync -ain --delete \
      --exclude='.git-local-state' \
      --include='AGENTS.md' --include='CLAUDE.md' --include='.mcp.json' \
      --include='.claude/***' --include='.codex/***' --include='.harness/***' \
      --include='.agents' --include='.agents/***' \
      --include='.githooks/***' --include='docs/***' \
      --exclude='*' \
      "$repo/" "projects/$name/" 2>/dev/null | grep -cE '^[<>ch*]' || true)
    [ "$drift" = "0" ] && pass "$name: snapshot in sync (both directions)" || warn "$name: snapshot drift ($drift changes incl. new/removed files) — run ./backup-projects.sh"
  else
    warn "$name: no snapshot yet"
  fi
done

# solo-master specific: exactly one Codex hook representation
echo "== codex layering =="
[ -f "$HOME/solo-master/.codex/hooks.json" ] && fail "solo-master: duplicate .codex/hooks.json exists (keep TOML only)" || pass "solo-master: single Codex hook representation (TOML)"

echo
echo "== result: $FAILS FAIL, $WARNS WARN =="
[ "$FAILS" -eq 0 ] || exit 1
