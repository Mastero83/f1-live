#!/bin/bash
# Build static web export for GitHub Pages under /f1-live
set -e; cd "$(dirname "$0")/.."
rm -rf dist && npx expo export -p web
sed -i 's|<meta name="viewport"[^>]*>|<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#111118">|' dist/index.html
touch dist/.nojekyll; cp dist/index.html dist/404.html
