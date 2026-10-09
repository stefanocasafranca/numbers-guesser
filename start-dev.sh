#!/usr/bin/env bash
set -e

# ==============================================================================
# Numbers Guesser — Local Full-Stack Development Runner
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "=========================================================="
echo " Starting Numbers Guesser (Local Development Suite)"
echo "=========================================================="

# Trap SIGINT/SIGTERM to gracefully terminate child processes
cleanup() {
  echo ""
  echo "Stopping services..."
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$FRONTEND_PID" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
  echo "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend
echo "--> Starting Backend on http://localhost:8000..."
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt
else
  source .venv/bin/activate
fi
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend health check
sleep 2

# 2. Start Vite Frontend
echo "--> Starting Frontend on http://localhost:5173..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo " Numbers Guesser is LIVE!"
echo " Frontend: http://localhost:5173"
echo " Backend API: http://localhost:8000"
echo " API Docs (Swagger): http://localhost:8000/docs"
echo " Press Ctrl+C to stop both servers"
echo "=========================================================="
echo ""

wait
