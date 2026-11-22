#!/usr/bin/env bash
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
#
# Replaces the whole tree of a generated branch (release, directory) with a
# build and pushes it as one commit. Does nothing when the tree is unchanged.
#
#   .github/scripts/push_branch.sh TREE_DIR BRANCH SOURCE_SHA
#
# Runs in CI with a checkout that can push to origin.
set -euo pipefail

tree="${1:?usage: push_branch.sh TREE_DIR BRANCH SOURCE_SHA}"
branch="${2:?usage: push_branch.sh TREE_DIR BRANCH SOURCE_SHA}"
source_sha="${3:?usage: push_branch.sh TREE_DIR BRANCH SOURCE_SHA}"
work="${RUNNER_TEMP:?RUNNER_TEMP is not set}/branch-$branch"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  git fetch origin "+refs/heads/$branch:refs/remotes/origin/$branch"
  git worktree add "$work" "origin/$branch"
  git -C "$work" switch -C "$branch"
else
  git worktree add --detach "$work"
  git -C "$work" switch --orphan "$branch"
fi
# Replace the whole tree with the new build.
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$tree/." "$work/"
git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "$branch branch already matches $source_sha"
  exit 0
fi
git -C "$work" commit -m "${branch^} build of $source_sha"
git -C "$work" push origin "$branch"
