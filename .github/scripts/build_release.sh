#!/usr/bin/env bash
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
#
# Builds the contents of the `release` branch: every tracked file on the
# current commit except the paths in .github/release_exclude.txt.
#
#   .github/scripts/build_release.sh OUTPUT_DIR
#
# OUTPUT_DIR must not exist yet. The script then checks the result: no
# excluded path survived, the plugin manifest and MCP config are present,
# and no shipped file references a test fixture.
set -euo pipefail

out="${1:?usage: build_release.sh OUTPUT_DIR}"
root="$(git rev-parse --show-toplevel)"
list="$root/.github/release_exclude.txt"

if [ -e "$out" ]; then
  echo "$out already exists; pass a new folder" >&2
  exit 1
fi
mkdir -p "$out"
out="$(cd "$out" && pwd)"

mapfile -t excludes < <(grep -v '^[[:space:]]*#' "$list" | sed 's/[[:space:]]*$//' | grep -v '^$')

is_excluded() {
  local f="$1" e
  for e in "${excludes[@]}"; do
    if [[ "$e" == */ ]]; then
      [[ "$f" == "$e"* ]] && return 0
    else
      [[ "$f" == "$e" ]] && return 0
    fi
  done
  return 1
}

cd "$root"
kept=0
dropped=0
while IFS= read -r -d '' f; do
  if is_excluded "$f"; then
    dropped=$((dropped + 1))
    continue
  fi
  mkdir -p "$out/$(dirname "$f")"
  cp -p "$f" "$out/$f"
  kept=$((kept + 1))
done < <(git ls-files -z)

fail=0
for e in "${excludes[@]}"; do
  if [ -e "$out/${e%/}" ]; then
    echo "excluded path is still present: $e" >&2
    fail=1
  fi
done
for f in .claude-plugin/plugin.json .mcp.json connector/index.js connector/package.json skills/patent-drawing/SKILL.md LICENSE NOTICE; do
  if [ ! -f "$out/$f" ]; then
    echo "required file is missing: $f" >&2
    fail=1
  fi
done
if grep -rIl --exclude=CHANGELOG.md -e 'test/fixtures' -e 'tests/fixtures' "$out" >/dev/null 2>&1; then
  echo "a shipped file still references a test fixture:" >&2
  grep -rIl --exclude=CHANGELOG.md -e 'test/fixtures' -e 'tests/fixtures' "$out" >&2
  fail=1
fi
if grep -q 'process\.env\|\${USPTO_ODP_API_KEY}' "$out/.mcp.json"; then
  echo ".mcp.json must pass the key from user_config, not the host environment" >&2
  fail=1
fi
if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "release build: $kept files kept, $dropped left out, written to $out"
