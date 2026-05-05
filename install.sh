#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ServerHub — Script d'installation standalone
# Usage : sudo bash install.sh
#
# Dépendances REQUISES sur le serveur hôte :
#   - Node.js >= 18  (le script peut l'installer via NodeSource si absent)
#   - npm            (fourni avec Node.js)
#   - openssl        (génération des secrets, présent sur toute distrib Linux)
#
# Dépendances NON requises sur le serveur hôte :
#   - MySQL / PostgreSQL : ServerHub est un CLIENT qui s'y connecte à distance
#     (comme phpMyAdmin). Aucun serveur DB local n'est nécessaire.
#   - rsync, apache, nginx, php : aucun
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/serverhub"
SERVICE_NAME="serverhub"
NODE_MIN_VERSION=18

# ── Vérifications préalables ─────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en tant que root (sudo bash install.sh)"
  exit 1
fi

# ── Node.js : installation automatique si absent ou trop ancien ───────────────
install_node() {
  echo "→ Installation de Node.js ${NODE_MIN_VERSION} via NodeSource..."
  if command -v curl &>/dev/null; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" | bash -
  elif command -v wget &>/dev/null; then
    wget -qO- "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" | bash -
  else
    echo "curl et wget sont introuvables. Installez Node.js ${NODE_MIN_VERSION}+ manuellement."
    exit 1
  fi
  apt-get install -y nodejs
}

if ! command -v node &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    install_node
  else
    echo "Node.js introuvable. Installez Node.js >= ${NODE_MIN_VERSION} puis relancez."
    exit 1
  fi
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]]; then
  echo "Node.js ${NODE_MIN_VERSION}+ requis (trouvé : $NODE_VERSION)"
  if command -v apt-get &>/dev/null; then
    install_node
  else
    echo "Mettez à jour Node.js manuellement puis relancez."
    exit 1
  fi
fi

# ── openssl (génération des secrets) ─────────────────────────────────────────
if ! command -v openssl &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    apt-get install -y openssl
  else
    echo "openssl introuvable. Installez-le puis relancez."
    exit 1
  fi
fi

# ── Accès internet pour npm ───────────────────────────────────────────────────

# -- Build tools (required by better-sqlite3 native addon) --------------------
# better-sqlite3 compiles a C++ extension during npm install.
need_build_tools=0
command -v python3 &>/dev/null || need_build_tools=1
command -v make    &>/dev/null || need_build_tools=1
command -v g++     &>/dev/null || need_build_tools=1

if [[ $need_build_tools -eq 1 ]]; then
  if command -v apt-get &>/dev/null; then
    step "Installing build tools (python3, make, g++ — required by SQLite native module)..."
    apt-get install -y python3 make g++ &>/dev/null
    ok "Build tools installed"
  else
    warn "python3, make and g++ are required to compile the SQLite native module."
    warn "Install build-essential (or equivalent) then re-run."
    echo -e "  ${DIM}  Press ${BOLD}Enter${RESET}${DIM} to continue, or ${BOLD}Ctrl+C${RESET}${DIM} to abort.${RESET}"
    read -r
  fi
else
  ok "Build tools detected (python3 / make / g++)"
fi
if ! curl -fsSL --max-time 5 https://registry.npmjs.org/ &>/dev/null \
  && ! wget -q --timeout=5 --spider https://registry.npmjs.org/ &>/dev/null; then
  echo "Attention : accès à registry.npmjs.org impossible. npm install risque d'échouer."
  echo "Appuyez sur Ctrl+C pour annuler, ou Entrée pour continuer quand même."
  read -r
fi

# ── Copie des sources ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
echo "→ Copie des fichiers dans ${APP_DIR}..."
mkdir -p "$APP_DIR"

# Exclude dev artifacts, secrets and local storage data from the copy
cd "$SCRIPT_DIR"
find . \
  -not -path '*/node_modules/*'      \
  -not -path '*/dist/*'              \
  -not -name '.env'                  \
  -not -name 'app-storage.json'      \
  -not -name 'app.db'               \
  -not -name 'app.db-shm'           \
  -not -name 'app.db-wal'           \
  | while IFS= read -r f; do
      dst="$APP_DIR/$f"
      if [[ -d "$f" ]]; then
        mkdir -p "$dst"
      else
        cp "$f" "$dst"
      fi
    done

# ── Installation des dépendances ──────────────────────────────────────────────
echo "→ Installation des dépendances backend..."
cd "$APP_DIR/backend"
npm install --omit=dev

echo "→ Installation des dépendances frontend..."
cd "$APP_DIR/frontend"
npm install

# ── Build ─────────────────────────────────────────────────────────────────────
echo "→ Build du frontend..."
cd "$APP_DIR/frontend"
npm run build

echo "→ Build du backend..."
cd "$APP_DIR/backend"
npm run build

# ── Fichier .env ──────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  GENERATED_PASS=$(openssl rand -hex 12)
  echo "→ Création du fichier .env..."
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=8080

# !! Modifiez ces valeurs avant d'exposer ServerHub sur internet !!
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${GENERATED_PASS}

# Laissez vide en standalone (le frontend est servi par le même processus)
CORS_ORIGINS=

# MySQL — optionnel, ServerHub s'y connecte à la demande (pas de serveur local requis)
# MYSQL_HOST=127.0.0.1
# MYSQL_PORT=3306
# MYSQL_USER=root
# MYSQL_PASSWORD=

# PostgreSQL — idem
# PG_HOST=127.0.0.1
# PG_PORT=5432
# PG_USER=postgres
# PG_PASSWORD=

FILES_ROOT=/var/www
EOF

  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║  Identifiants générés automatiquement    ║"
  echo "  ║  Login : admin                           ║"
  echo "  ║  Mot de passe : ${GENERATED_PASS}  ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo "  Config complète : ${ENV_FILE}"
  echo ""
fi

# ── Service systemd ───────────────────────────────────────────────────────────
echo "→ Création du service systemd (démarrage automatique au boot)..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=ServerHub — Server Management Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=$(which node) dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# ── Résultat ──────────────────────────────────────────────────────────────────
PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 || echo "8080")
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✓ ServerHub installé et démarré."
echo ""
echo "  → http://${SERVER_IP}:${PORT}"
echo ""
echo "  Commandes utiles :"
echo "    journalctl -u ${SERVICE_NAME} -f          # logs en temps réel"
echo "    systemctl status ${SERVICE_NAME}           # état du service"
echo "    systemctl restart ${SERVICE_NAME}          # redémarrer"
echo "    bash ${APP_DIR}/update.sh                 # mettre à jour"
echo ""

