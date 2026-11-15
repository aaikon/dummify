#!/usr/bin/env bash
# scripts/check-release.sh: build the store zips and prove they're ready to upload (T-013).
#
#   1. Builds .output/dummify-<version>-chrome.zip, -firefox.zip, and -sources.zip (the AMO sources archive).
#   2. Checks that every file in the sources zip is tracked by git (nothing local or private can ride along).
#   3. Rebuilds from the extracted sources zip in a temporary folder, as an AMO reviewer would
#      (npm ci + npm run zip:firefox), and checks the result is identical to the Firefox zip being uploaded.
#
# Run it from a clean checkout of the release tag. It needs the npm registry (or a warm npm cache) for npm ci.
# Slow (a full install and two builds), so it isn't part of scripts/verify.sh.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

version="$(node -p 'require("./package.json").version')"
out=.output
chrome="$out/dummify-$version-chrome.zip"
firefox="$out/dummify-$version-firefox.zip"
sources="$out/dummify-$version-sources.zip"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✘ working tree has uncommitted changes; release builds come from a clean checkout" >&2
  exit 1
fi

rm -rf "$out"
npm run --silent zip >/dev/null
npm run --silent zip:firefox >/dev/null
for f in "$chrome" "$firefox" "$sources"; do [[ -f "$f" ]] || { echo "✘ missing $f" >&2; exit 1; }; done
echo "✔ built $chrome, $firefox, $sources"

untracked="$(comm -23 <(unzip -Z1 "$sources" | grep -v '/$' | sort) <(git ls-files | sort))"
if [[ -n "$untracked" ]]; then
  printf '✘ the sources zip contains files git does not track:\n%s\n' "$untracked" >&2
  exit 1
fi
echo "✔ sources zip: $(unzip -Z1 "$sources" | grep -vc '/$') files, all tracked by git"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unzip -q "$sources" -d "$tmp/src"
unzip -q "$firefox" -d "$tmp/uploaded"
(
  cd "$tmp/src"
  npm ci --prefer-offline --no-audit --no-fund >/dev/null
  npm run --silent zip:firefox >/dev/null
)
if ! diff -r "$tmp/src/.output/firefox-mv3" "$tmp/uploaded" >/dev/null; then
  echo "✘ a rebuild from the sources zip differs from $firefox:" >&2
  diff -rq "$tmp/src/.output/firefox-mv3" "$tmp/uploaded" >&2 || true
  exit 1
fi
echo "✔ rebuilt from the sources zip: identical to $firefox"
echo "Built with Node $(node -v), npm $(npm -v). Put these versions in the AMO reviewer notes."
