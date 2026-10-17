#!/usr/bin/env bash
# Fails if any commit message or identity in the current history mentions tooling
# attribution, or if any commit has an author/committer other than the project owner.
set -euo pipefail

EXPECTED="Rayan Jain <rayansjain@gmail.com>"
status=0

hits=$(git log --format='%an <%ae> | %cn <%ce>%n%B' | grep -i -E 'claude|anthropic|co-authored|generated' || true)
if [[ -n "$hits" ]]; then
  echo "Forbidden attribution text found in history:"
  echo "$hits"
  status=1
fi

bad=$(git log --format='%h %an <%ae> | %cn <%ce>' | grep -v -F "$EXPECTED | $EXPECTED" || true)
if [[ -n "$bad" ]]; then
  echo "Commits with an unexpected author or committer:"
  echo "$bad"
  status=1
fi

if [[ $status -eq 0 ]]; then
  echo "History check passed ($(git rev-list --count HEAD) commits)."
fi
exit $status
