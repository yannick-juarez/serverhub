#!/usr/bin/env bash
# ==============================================================================
#   ServerHub Updater
#   Usage: sudo bash update.sh
# ==============================================================================
set -euo pipefail

readonly APP_DIR="/opt/serverhub"
readonly SERVICE_NAME="serverhub"

if [[ -t 1 ]]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
  GREEN="\033[32m"; CYAN="\033[36m"; YELLOW="\033[33m"; RED="\033[31m"; WHITE="\033[97m"
else
  RESET="" BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" WHITE=""
fi

step()    { echo -e "  ${CYAN}${BOLD}→${RESET}  ${BOLD}$1${RESET}"; }
ok()      { echo -e "  ${GREEN}${BOLD}✓${RESET}  ${DIM}$1${RESET}"; }
fail()    { echo ""; echo -e "  ${RED}${BOLD}✗  Error: $1${RESET}"; echo ""; exit 1; }
section() {
  echo ""
  echo -e "  ${DIM}────────────────────────────────────────────────────────────${RESET}"
  echo -e "  ${WHITE}${BOLD}$1${RESET}"
  echo -e "  ${DIM}────────────────────────────────────────────────────────────${RESET}"
  echo ""
}

[[ $EUID -ne 0 ]] && fail "Run as root: sudo bash update.sh"
[[ ! -d "$APP_DIR" ]] && fail "ServerHub is not installed at ${APP_DIR}. Run install.sh first."

echo ""
echo -e "  ${WHITE}${BOLD}ServerHub — Update${RESET}  ${DIM}$(date '+%Y-%m-%d %H:%M')${RESET}"
echo ""

section "Stopping Service"
step "Stopping ${SERVICE_NAME}..."
systemctl stop "$SERVICE_NAME"
ok "Service stopped"

section "Copying Updated Files"
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
step "Syncing sources to ${APP_DIR}..."
cd "$SCRIPT_DIR"
find . \
  -not -path '*/node_modules/*'    \
  -not -path '*/dist/*'            \
  -not -name '.env'                \
  -not -name 'app-storage.json'    \
  -not -name 'app.db'             \
  -not -name 'app.db-shm'         \
  -not -name 'app.db-wal'         \
  | while IFS= read -r f; do
      dst="$APP_DIR/$f"
      if [[ -d "$f" ]]; then
        mkdir -p "$dst"
      else
        cp "$f" "$dst"
      fi
    done
ok "Files updated"

section "Rebuilding"
step "Installing backend dependencies (with dev)..."
cd "$APP_DIR/backend" && npm install --silent
ok "Backend dependencies ready"

step "Installing frontend dependencies..."
cd "$APP_DIR/frontend" && npm install --silent
ok "Frontend dependencies ready"

step "Building frontend..."
cd "$APP_DIR/frontend" && npm run build --silent
ok "Frontend built"

step "Compiling backend..."
cd "$APP_DIR/backend" && npm run build --silent
ok "Backend compiled"

step "Pruning backend dev dependencies..."
cd "$APP_DIR/backend" && npm prune --omit=dev --silent
ok "Backend dev dependencies removed"

section "Restarting Service"
step "Starting ${SERVICE_NAME}..."
systemctl start "$SERVICE_NAME"
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "Service is running"
else
  echo -e "  ${YELLOW}${BOLD}⚠${RESET}  ${YELLOW}Service may have failed. Check: journalctl -u ${SERVICE_NAME} -n 50${RESET}"
fi

echo ""
echo -e "  ${DIM}────────────────────────────────────────────────────────────${RESET}"
echo ""
echo -e "  ${GREEN}${BOLD}  Update complete.${RESET}"
echo ""
echo -e "  ${DIM}  journalctl -u ${SERVICE_NAME} -f   ${RESET}  live logs"
echo ""
echo -e "  ${DIM}────────────────────────────────────────────────────────────${RESET}"
echo ""
