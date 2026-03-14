#!/usr/bin/env bash
# Build script — runs on Railway/Render/Fly during deployment
set -e

echo "==> Node $(node -v) / npm $(npm -v)"
echo "==> Python $(python3 --version)"

echo ""
echo "==> [1/2] Building React frontend..."
cd frontend
npm ci --prefer-offline
npm run build
cd ..

echo ""
echo "==> [2/2] Installing Python dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo ""
echo "==> Build complete. Frontend dist ready at frontend/dist/"
