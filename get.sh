#!/usr/bin/env bash
# ==============================================================================
#   ServerHub — Remote installer
#   One-liner: curl -fsSL https://raw.githubusercontent.com/yannick-juarez/serverhub/main/get.sh | sudo bash
# ==============================================================================
set -euo pipefail

REPO="https://github.com/yannick-juarez/serverhub"
REPO_RAW="https://raw.githubusercontent.com/yannick-juarez/serverhub/main"
INSTALL_DIR="/opt/serverhub-src"

if [[ -t 1 ]]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
  GREEN="\033[32m"; CYAN="\033[36m"; YELLOW="\033[33m"; RED="\033[31m"; WHITE="\033[97m"
else
  RESET="" BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" WHITE=""
fi

step() { echo -e "  ${CYAN}${BOLD}→${RESET}  ${BOLD}$1${RESET}"; }
ok()   { echo -e "  ${GREEN}${BOLD}✓${RESET}  ${DIM}$1${RESET}"; }
fail() { echo ""; echo -e "  ${RED}${BOLD}✗  $1${RESET}"; echo ""; exit 1; }

[[ $EUID -ne 0 ]] && fail "Run as root: curl ... | sudo bash"

echo ""
echo -e "  ${WHITE}${BOLD}ServerHub — Remote Install${RESET}"
echo ""

# ── Download strategy: git clone (preferred) or zip fallback ──────────────────
if command -v git &>/dev/null; then
  step "Cloning repository..."
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" pull --ff-only
    ok "Repository updated"
  else
    rm -rf "$INSTALL_DIR"
    git clone --depth=1 "$REPO" "$INSTALL_DIR"
    ok "Repository cloned"
  fi
elif command -v curl &>/dev/null; then
  step "Downloading archive (curl)..."
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "${REPO}/archive/refs/heads/main.tar.gz" \
    | tar -xz -C "$INSTALL_DIR" --strip-components=1
  ok "Archive extracted"
elif command -v wget &>/dev/null; then
  step "Downloading archive (wget)..."
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  wget -qO- "${REPO}/archive/refs/heads/main.tar.gz" \
    | tar -xz -C "$INSTALL_DIR" --strip-components=1
  ok "Archive extracted"
else
  fail "git, curl and wget are all missing. Install one of them and retry."
fi

# ── Hand off to install.sh ────────────────────────────────────────────────────
step "Running installer..."
echo ""
bash "$INSTALL_DIR/install.sh"
