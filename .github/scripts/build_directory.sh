#!/usr/bin/env bash
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
#
# Builds the contents of the `directory` branch: the edition submitted to
# the Claude plugin directory. The directory accepts only Markdown, text,
# JSON, YAML and images from organizations that are not Verified, so this
# edition is the Patent Drawing skill alone, with no connector, scripts or
# SVG files. The full plugin keeps shipping from the `release` branch.
#
#   .github/scripts/build_directory.sh OUTPUT_DIR
#
# OUTPUT_DIR must not exist yet and must be outside this repository. The
# build:
#   1. copies the files listed in .github/directory/include.txt,
#   2. applies .github/directory/skill.patch, which rewrites the skill's
#      steps that ran scripts into checks Claude does from the SVG source,
#   3. turns the template and example SVGs into Markdown code blocks,
#   4. writes the README, privacy policy and a plugin.json without the
#      connector's userConfig,
#   5. runs .github/scripts/check_directory.mjs on the result.
#
# When a change to main makes the patch fail, rebuild the edited files:
# copy skills/patent-drawing to a scratch git repository, apply the old
# patch by hand, edit, and save `git diff` over skill.patch.
set -euo pipefail

out="${1:?usage: build_directory.sh OUTPUT_DIR}"
root="$(git rev-parse --show-toplevel)"
dir="$root/.github/directory"

if [ -e "$out" ]; then
  echo "$out already exists; pass a new folder" >&2
  exit 1
fi
mkdir -p "$out"
out="$(cd "$out" && pwd)"
if git -C "$out" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # git apply silently skips paths outside the current folder when it
  # runs inside a repository, so the patch could be half applied.
  echo "$out is inside a git repository; pass a folder outside it" >&2
  rmdir "$out"
  exit 1
fi

cd "$root"
copy() {
  mkdir -p "$out/$(dirname "$2")"
  cp -p "$1" "$out/$2"
}
mapfile -t includes < <(grep -v '^[[:space:]]*#' "$dir/include.txt" | sed 's/[[:space:]]*$//' | grep -v '^$')
for e in "${includes[@]}"; do
  if [[ "$e" == */ ]]; then
    mapfile -t found < <(git ls-files -- "$e" | grep '\.png$')
    if [ "${#found[@]}" -eq 0 ]; then
      echo "include.txt: no PNG files under $e" >&2
      exit 1
    fi
    for f in "${found[@]}"; do copy "$f" "$f"; done
  else
    git ls-files --error-unmatch -- "$e" >/dev/null 2>&1 || { echo "include.txt: $e is not tracked" >&2; exit 1; }
    copy "$e" "$e"
  fi
done
copy "$dir/README.md" README.md
copy "$dir/PRIVACY.md" PRIVACY.md

# Text goes out as LF whatever the checkout used, so the patch applies on
# Windows too.
while IFS= read -r -d '' f; do
  sed -i 's/\r$//' "$f"
done < <(find "$out" -type f ! -name '*.png' -print0)

# The vendored svgelements stays on main with the checker that uses it.
notice="$out/skills/patent-drawing/NOTICE"
sed -i '/^Third party code$/,$d' "$notice"
sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$notice"
if grep -q svgelements "$notice"; then
  echo "skills/patent-drawing/NOTICE still names svgelements" >&2
  exit 1
fi

tr -d '\r' < "$dir/skill.patch" | (cd "$out" && git apply --whitespace=nowarn -p1 -)

skill="$out/skills/patent-drawing"
code_block() {
  printf '```xml\n'
  tr -d '\r' < "$1"
  printf '```\n'
}
{
  printf '# Blank Drawing Sheets\n\n'
  printf 'Start every sheet from one of these templates and save it as its own\n'
  printf '`.svg` file. The viewBox is in millimetres. Delete the `margin-guides`\n'
  printf 'group before checking or delivery.\n\n'
  printf '## US Letter (216 x 279 mm)\n\n'
  code_block skills/patent-drawing/assets/blank-sheet-us-letter.svg
  printf '\n## A4 (210 x 297 mm)\n\n'
  code_block skills/patent-drawing/assets/blank-sheet-a4.svg
} > "$skill/assets/blank-sheets.md"

examples=(
  "fig-1-claim-flowchart.svg|FIG. 1: claim flowchart|One method claim drawn as a flowchart, with a decision that loops back."
  "fig-1-software-method.svg|FIG. 1: software method|A software method flowchart with numbered steps."
  "sideways-sheet/fig-2.svg|FIG. 2: sideways sheet|A figure too wide for an upright sheet, turned with one group transform (complex-figures.md, \"Sideways sheets\")."
  "two-sheet-flowchart/fig-3a.svg|FIG. 3A: flowchart, first sheet|Ends with off page connector A."
  "two-sheet-flowchart/fig-3b.svg|FIG. 3B: flowchart, second sheet|Starts from off page connector A; step numerals run on from FIG. 3A."
  "two-figures-one-sheet/fig-4.svg|FIG. 4A and FIG. 4B: two figures on one sheet|Two small views, each with its own label and clear space between them."
  "ui-screen/fig-5.svg|FIG. 5: user interface screen|A device outline and screen with numbered elements and lead lines from outside the device."
)
{
  printf '# Example Sheets\n\n'
  printf 'Each sheet below passes every check in SKILL.md step 4. Copy their\n'
  printf 'patterns (boxes, arrowheads, lead lines, label placement), not their\n'
  printf 'content.\n'
  for x in "${examples[@]}"; do
    IFS='|' read -r path title note <<< "$x"
    printf '\n## %s\n\n%s\n\n' "$title" "$note"
    code_block "skills/patent-drawing/examples/$path"
  done
} > "$skill/examples/svg-examples.md"

node -e '
  const fs = require("fs");
  const [src, dst] = process.argv.slice(1);
  const p = JSON.parse(fs.readFileSync(src, "utf8"));
  delete p.userConfig;
  p.description = "USPTO patent drawing skill: drafts and checks figures under 37 CFR 1.84 " +
    "(software flowcharts, block diagrams, UI screens) plus design, plant and PCT/EPO guidance.";
  p.keywords = (p.keywords || []).filter((k) => k !== "prior art");
  p.privacyPolicyUrl = "https://github.com/Beginnerinvestorhub/patent-tools/blob/directory/PRIVACY.md";
  fs.writeFileSync(dst, JSON.stringify(p, null, 2) + "\n");
' .claude-plugin/plugin.json "$out/.claude-plugin/plugin.json"

node "$root/.github/scripts/check_directory.mjs" "$out"
echo "directory build: $(find "$out" -type f | wc -l | tr -d ' ') files, written to $out"
