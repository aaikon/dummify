#!/usr/bin/env bash
# Regenerate the extension's PNG icons from src/assets/brand/mark.svg (T-029).
# Needs ImageMagick with its SVG (librsvg) delegate. The PNGs are committed, so this only runs when the mark changes.
#   public/icon/<size>.png      full icon (WXT picks these up for the manifest and toolbar)
#   public/icon/dim-<size>.png  40% opacity variant for "off" / "no site access" (docs/style-guide.md)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p public/icon
for size in 16 32 48 96 128; do
  magick -background none -density 1024 src/assets/brand/mark.svg -resize "${size}x${size}" "public/icon/${size}.png"
  magick "public/icon/${size}.png" -channel A -evaluate multiply 0.4 +channel "public/icon/dim-${size}.png"
done
echo "✔ icons written to public/icon/"
