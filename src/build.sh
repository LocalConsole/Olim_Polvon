#!/bin/sh
# Build the site from src/ and copy the result to the repo root (GitHub Pages).
set -e
cd "$(dirname "$0")"
cat assets/fonts2/fonts.css assets/base.css assets/pages.css assets/theme.css > assets/style.css
python3 build.py && python3 build_i18n.py          # makes *.html, uz/, en/
python3 make_worker.py && python3 make_gas.py      # makes ../worker/worker.js and Code.gs (paths inside scripts)
# publish: copy html + used assets to repo root
for f in *.html robots.txt sitemap.xml site.webmanifest share.jpg; do cp "$f" ../; done
cp -r uz en ../
mkdir -p ../assets && cp assets/app.js assets/style.css assets/*.png assets/ph-logo.webp ../assets/ && cp -r assets/fonts2 ../assets/
for f in $(cat *.html uz/*.html en/*.html assets/style.css assets/app.js | grep -oE 'assets/(img|menu)/[A-Za-z0-9._-]+' | sort -u); do mkdir -p ../$(dirname $f); cp $f ../$f; done
rm -rf uz en *.html assets/style.css
