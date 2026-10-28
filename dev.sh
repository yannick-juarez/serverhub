#!/usr/bin/env bash
# ServerHub - Run backend and frontend development servers together.
# Usage: ./dev.sh
set -euo pipefail

readonly SCRIPT_DIR="$(dirname "$(realpath "$0")")"
readonly BACKEND_PORT=4000
readonly FRONTEND_PORT=5173

backend_pid=""
frontend_pid=""

cleanup() {
  trap - EXIT

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi

  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}

ensure_dependencies() {
  local package_dir="$1"
  local required_binary="$2"

  if [[ ! -x "${package_dir}/node_modules/.bin/${required_binary}" ]]; then
    echo "Installing dependencies in ${package_dir}..."
    (cd "$package_dir" && npm ci)
  fi
}

command -v node &>/dev/null || { echo "Node.js is required."; exit 1; }
command -v npm &>/dev/null || { echo "npm is required."; exit 1; }

ensure_dependencies "$SCRIPT_DIR/backend" "tsx"
ensure_dependencies "$SCRIPT_DIR/frontend" "vite"

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting ServerHub in development mode..."
echo "  Frontend: http://localhost:${FRONTEND_PORT}"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "Press Ctrl+C to stop both servers."
echo ""

(
  cd "$SCRIPT_DIR/backend"
  PORT="$BACKEND_PORT" NODE_ENV=development npm run dev
) &
backend_pid=$!

(
  cd "$SCRIPT_DIR/frontend"
  npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort
) &
frontend_pid=$!

set +e
wait -n "$backend_pid" "$frontend_pid"
exit_code=$?
set -e

if [[ $exit_code -ne 0 ]]; then
  echo "A development server stopped with an error."
fi

exit "$exit_code"