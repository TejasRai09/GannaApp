#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GannaApp — deploy / redeploy.
# Run from anywhere on the Lightsail instance:  bash ~/GannaApp/deploy/deploy.sh
# Pulls latest code, installs deps, builds frontend + backend, restarts service.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "==> Deploying from ${ROOT}"

if [ ! -f .env ]; then
  echo "!! .env not found. Run:  cp .env.example .env  && nano .env"
  exit 1
fi

# JWT_SECRET must be real in production — the app refuses to log anyone in without it.
if ! grep -qE '^JWT_SECRET=.+' .env; then
  echo "!! JWT_SECRET is empty in .env. Generate one:  openssl rand -base64 48"
  exit 1
fi

echo "==> Pulling latest code"
git fetch origin
git reset --hard origin/main

# devDependencies are needed on the server: TypeScript builds the backend,
# Vite + Tailwind build the frontend. This app is small, so that is fine.
echo "==> Installing backend dependencies"
npm ci

echo "==> Building backend (src -> dist)"
npx tsc -p tsconfig.json

echo "==> Installing + building frontend (frontend -> frontend/dist)"
cd frontend
npm ci
npm run build
cd "${ROOT}"

# Fail before restarting rather than swapping in a broken build
if [ ! -f dist/server.js ]; then
  echo "!! backend build produced no dist/server.js — aborting"
  exit 1
fi
if [ ! -f frontend/dist/index.html ]; then
  echo "!! frontend build produced no index.html — aborting"
  exit 1
fi

echo "==> Restarting service"
sudo systemctl restart gannaapp
sleep 3
sudo systemctl --no-pager --lines=0 status gannaapp || true

echo "==> Health check"
if curl -fsS http://127.0.0.1:4000/api/health; then
  echo ""
  echo "Deploy OK."
else
  echo ""
  echo "!! Health check failed. Logs:  sudo journalctl -u gannaapp -n 50 --no-pager"
  exit 1
fi
