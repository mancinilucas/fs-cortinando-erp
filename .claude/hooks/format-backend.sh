#!/usr/bin/env bash
set -euo pipefail

project="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file=$(jq -r '.tool_input.file_path // empty' <<<"$(cat)")

[ -n "$file" ] || exit 0

case "$file" in
  "$project"/backend/src/*.ts|"$project"/backend/test/*.ts) ;;
  *) exit 0 ;;
esac

cd "$project/backend"

./node_modules/.bin/prettier --write "$file" >/dev/null
./node_modules/.bin/oxlint --type-aware --quiet "$file"
