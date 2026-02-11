#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Parse arguments
TOOL="claude"
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    *)
      MAX_ITERATIONS="$1"
      shift
      ;;
  esac
done

echo "🔄 Ralph — Autonomous Agent Loop"
echo "   Tool: $TOOL"
echo "   Max iterations: $MAX_ITERATIONS"
echo "   PRD: $PRD_FILE"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo "❌ jq is required. Install with: brew install jq (macOS) or sudo apt install jq (Linux)"
  exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
  echo "❌ prd.json not found at $PRD_FILE"
  echo "   Copy prd.json.example and customize it."
  exit 1
fi

# Read branch name from prd.json
BRANCH_NAME=$(jq -r '.branchName' "$PRD_FILE")
echo "📋 Branch: $BRANCH_NAME"

# Archive if branch changed
if [ -f "$LAST_BRANCH_FILE" ]; then
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE")
  if [ "$LAST_BRANCH" != "$BRANCH_NAME" ]; then
    ARCHIVE_DIR="$SCRIPT_DIR/archive/$(date +%Y-%m-%d)-$(echo "$LAST_BRANCH" | sed 's/ralph\///')"
    echo "📦 Branch changed. Archiving previous run to $ARCHIVE_DIR"
    mkdir -p "$ARCHIVE_DIR"
    [ -f "$PRD_FILE.bak" ] && cp "$PRD_FILE.bak" "$ARCHIVE_DIR/prd.json"
    [ -f "$PROGRESS_FILE" ] && mv "$PROGRESS_FILE" "$ARCHIVE_DIR/progress.txt"
  fi
fi

echo "$BRANCH_NAME" > "$LAST_BRANCH_FILE"

# Create progress file if needed
if [ ! -f "$PROGRESS_FILE" ]; then
  cat > "$PROGRESS_FILE" << EOF
# Ralph Progress Log
Started: $(date)
---
EOF
  echo "📝 Created progress.txt"
fi

echo ""

# Main loop
for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔁 Iteration $i / $MAX_ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check if all stories pass
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
  if [ "$REMAINING" -eq 0 ]; then
    echo ""
    echo "🎉 All user stories complete!"
    exit 0
  fi
  echo "📊 $REMAINING stories remaining"

  # Run the AI tool
  if [ "$TOOL" = "claude" ]; then
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1) || true
  elif [ "$TOOL" = "amp" ]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1) || true
  else
    echo "❌ Unknown tool: $TOOL"
    exit 1
  fi

  echo "$OUTPUT" | tail -20

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "🎉 All user stories complete!"
    exit 0
  fi

  echo ""
  echo "⏳ Sleeping 2s before next iteration..."
  sleep 2
done

echo ""
echo "⚠️  Max iterations ($MAX_ITERATIONS) reached. Some stories may be incomplete."
exit 1
