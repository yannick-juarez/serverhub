#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ServerHub — Build script
# Usage : sudo bash build.sh
#
# Reinstalls dependencies, runs audit fix, and rebuilds frontend + backend.
# Use this after updating source files (does not touch .env, nginx, or systemd).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/serverhub"
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
SERVICE_NAME="serverhub"
NODE_MIN_VERSION=22

get_node_major_version() {
  if ! command -v node &>/dev/null; then
    return 1
  fi

  node -e "process.stdout.write(process.versions.node.split('.')[0])"
}

# ── Preflight checks ─────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo bash build.sh)"
  exit 1
fi

NODE_VERSION="$(get_node_major_version || true)"
if [[ -z "$NODE_VERSION" || "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]]; then
  echo "Node.js ${NODE_MIN_VERSION}+ is required (detected: ${NODE_VERSION:-missing})."
  echo "Run install.sh first, or install Node.js manually."
  exit 1
fi

if [[ ! -d "$APP_DIR/backend" || ! -d "$APP_DIR/frontend" ]]; then
  echo "ServerHub not found at ${APP_DIR}."
  echo "Run install.sh first."
  exit 1
fi

sync_sources() {
  local source_dir target_dir source_real target_real
  source_dir="$1"
  target_dir="$2"
  source_real="$(realpath "$source_dir")"
  target_real="$(realpath "$target_dir")"

  if [[ "$source_real" == "$target_real" ]]; then
    echo "→ Source and target are the same directory (${target_real}); skipping source sync."
    return
  fi

  if [[ ! -d "$source_dir/backend" || ! -d "$source_dir/frontend" ]]; then
    echo "Current script directory does not look like a ServerHub source tree: ${source_dir}"
    echo "Expected to find backend/ and frontend/."
    exit 1
  fi

  echo "→ Syncing sources from ${source_dir} to ${target_dir}..."
  cd "$source_dir"
  find . \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -name '.env' \
    -not -name 'app-storage.json' \
    -not -name 'app.db' \
    -not -name 'app.db-shm' \
    -not -name 'app.db-wal' \
    | while IFS= read -r f; do
        dst="$target_dir/$f"
        if [[ -d "$f" ]]; then
          mkdir -p "$dst"
        else
          cp "$f" "$dst"
        fi
      done
}

sync_sources "$SCRIPT_DIR" "$APP_DIR"

# ── Build tools (required by better-sqlite3 native addon) ────────────────────
need_build_tools=0
command -v python3 &>/dev/null || need_build_tools=1
command -v make    &>/dev/null || need_build_tools=1
command -v g++     &>/dev/null || need_build_tools=1

if [[ $need_build_tools -eq 1 ]]; then
  if command -v apt-get &>/dev/null; then
    echo "→ Installing build tools (python3, make, g++)..."
    apt-get install -y python3 make g++ &>/dev/null
    echo "✓ Build tools installed"
  else
    echo "Warning: python3, make and g++ are required to compile the native SQLite module."
    echo "Press Enter to continue, or Ctrl+C to cancel."
    read -r
  fi
else
  echo "✓ Build tools detected (python3 / make / g++)"
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo "→ Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install

echo "→ Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

# ── Audit fix ────────────────────────────────────────────────────────────────
echo "→ Running npm audit fix for backend..."
cd "$APP_DIR/backend"
npm audit fix || echo "Warning: npm audit fix failed for backend. Continuing."

echo "→ Running npm audit fix for frontend..."
cd "$APP_DIR/frontend"
npm audit fix || echo "Warning: npm audit fix failed for frontend. Continuing."

# ── Build ─────────────────────────────────────────────────────────────────────
echo "→ Building frontend..."
cd "$APP_DIR/frontend"
npm run build

echo "→ Building backend..."
cd "$APP_DIR/backend"
npm run build

echo "→ Pruning backend development dependencies..."
cd "$APP_DIR/backend"
npm prune --omit=dev

# ── Restart service ───────────────────────────────────────────────────────────
echo "→ Restarting ${SERVICE_NAME}..."
systemctl restart "$SERVICE_NAME"

echo ""
echo "✓ Build complete — ${SERVICE_NAME} restarted."
echo ""
echo "  journalctl -u ${SERVICE_NAME} -f    # live logs"
echo ""
