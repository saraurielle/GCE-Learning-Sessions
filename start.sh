#!/usr/bin/env bash
# Starts the GCE Learning Session (backend + frontend) on http://localhost:3000
set -e
cd "$(dirname "$0")/backend"
[ -d node_modules ] || npm install
[ -f .env ] || cp .env.example .env
echo "Open http://localhost:3000"
exec node server.js
