#!/usr/bin/env bash
# Point git at the versioned hooks in .githooks/. Run once per clone. Safe to re-run.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
chmod +x .githooks/*
git config core.hooksPath .githooks
echo "✔ git hooks installed (core.hooksPath=.githooks): $(ls .githooks | tr '\n' ' ')"
