#!/usr/bin/env sh
# Syntax-check every JS module and write JUnit XML for Jenkins.
RESULTS_DIR="tests/results"
mkdir -p "$RESULTS_DIR"
XML="$RESULTS_DIR/syntax.xml"

PASS=0
FAIL=0
CASES=""

for f in js/*.js; do
  ERR=$(node --check "$f" 2>&1)
  STATUS=$?
  if [ "$STATUS" -eq 0 ]; then
    printf 'OK   %s\n' "$f"
    CASES="${CASES}  <testcase name=\"$f\" classname=\"syntax\"/>\n"
    PASS=$((PASS + 1))
  else
    printf 'FAIL %s\n' "$f"
    printf '%s\n' "$ERR" >&2
    # Collapse to one line and escape XML special chars for the attribute value.
    MSG=$(printf '%s' "$ERR" | tr '\n' ' ' | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')
    CASES="${CASES}  <testcase name=\"$f\" classname=\"syntax\"><failure message=\"${MSG}\"/></testcase>\n"
    FAIL=$((FAIL + 1))
  fi
done

TOTAL=$((PASS + FAIL))
{
  printf '<?xml version="1.0" encoding="UTF-8"?>\n'
  printf '<testsuite name="Syntax Check" tests="%d" failures="%d" errors="0">\n' "$TOTAL" "$FAIL"
  printf '%b' "$CASES"
  printf '</testsuite>\n'
} > "$XML"

printf '\n%d passed  %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
