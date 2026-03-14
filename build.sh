#!/usr/bin/env bash
# Railway/Render build script — only Python needed on the server.
# The frontend/dist/ folder is pre-built and committed to git.
set -e

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  PYTHON=python
fi
echo "==> $($PYTHON --version 2>&1)"

echo ""
echo "==> Installing Python dependencies..."
cd backend
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r requirements.txt
cd ..

echo ""
echo "==> Build complete."
