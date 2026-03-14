#!/usr/bin/env bash
# Run from repo root: cd into backend then start gunicorn.
# Uses script location so it works no matter what the current directory is.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend" || { echo "Missing backend at $ROOT/backend"; ls -la "$ROOT"; exit 1; }
PORT="${PORT:-8080}"
exec gunicorn --worker-class eventlet -w 1 app:app --bind "0.0.0.0:${PORT}"
