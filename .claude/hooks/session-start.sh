#!/bin/bash
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

command -v claude >/dev/null 2>&1 || exit 0

if ! claude plugin list 2>/dev/null | grep -q '^\s*>\s*caveman@caveman'; then
  claude plugin marketplace add JuliusBrussee/caveman >/dev/null 2>&1
  claude plugin install caveman@caveman >/dev/null 2>&1
fi

exit 0
