#!/usr/bin/env bash
set -e
PORT="${PORT:-8080}"
exec gunicorn --worker-class eventlet -w 1 app:app --bind "0.0.0.0:${PORT}"
