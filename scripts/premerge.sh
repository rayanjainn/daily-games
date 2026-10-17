#!/usr/bin/env bash
# Gate run before merging a branch into main: same checks as CI's fast job, plus a clean tree.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm -s format:check
pnpm -s lint
pnpm -s typecheck >/dev/null
pnpm -s test >/dev/null && echo "Unit tests passed."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean:"
  git status --short
  exit 1
fi
bash scripts/check-history.sh
