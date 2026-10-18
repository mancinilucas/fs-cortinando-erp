#!/usr/bin/env bash
set -euo pipefail

project="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file=$(jq -r '.tool_input.file_path // empty' <<<"$(cat)")

[ -n "$file" ] || exit 0

base=$(basename "$file")

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

ask() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

case "$base" in
  .env|.env.local|.env.development.local|.env.test.local|.env.production.local|.env.production)
    deny "Protected secret file. Edit it manually and confirm with the user."
    ;;
  pnpm-lock.yaml|package-lock.json|yarn.lock)
    deny "Lockfile changes are dependency changes. Confirm with the user first."
    ;;
esac

case "$file" in
  "$project"/backend/prisma/*)
    ask "schema.prisma and migrations may only change in an authorized Prisma task. Confirm this edit."
    ;;
esac

exit 0
