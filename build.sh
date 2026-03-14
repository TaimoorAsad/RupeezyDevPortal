#!/usr/bin/env bash
# Railway/Render build script — only Python needed on the server.
# The frontend/dist/ folder is pre-built and committed to git.
set -e

echo "==> Python $(python3 --version 2>&1 || python --version)"

echo ""
echo "==> Installing Python dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo ""
echo "==> Build complete."
