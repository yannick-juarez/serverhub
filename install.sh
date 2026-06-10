#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ServerHub — Standalone installation script
# Usage : sudo bash install.sh
#
# REQUIRED dependencies on the host server:
#   - Node.js >= 22  (the script can install it via NodeSource if missing)
#   - npm            (bundled with Node.js)
#   - openssl        (used to generate secrets, available on most Linux distros)
#   - nginx + certbot (optional: installed automatically when enabling domain)
#
# NOT required on the host server:
#   - MySQL / PostgreSQL: ServerHub is a CLIENT that connects to them remotely
#     (like phpMyAdmin). No local DB server is required.
#   - rsync, apache, php: none
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/serverhub"
SERVICE_NAME="serverhub"
NODE_MIN_VERSION=22
NODE_DISTRO_VERSION="22.16.0"
NGINX_SITE_NAME="serverhub"
NON_INTERACTIVE=0
DOMAINS_CSV=""
LETSENCRYPT_EMAIL=""
APP_PORT_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive)
      NON_INTERACTIVE=1
      shift
      ;;
    --domains)
      DOMAINS_CSV="${2:-}"
      shift 2
      ;;
    --domains=*)
      DOMAINS_CSV="${1#*=}"
      shift
      ;;
    --email)
      LETSENCRYPT_EMAIL="${2:-}"
      shift 2
      ;;
    --email=*)
      LETSENCRYPT_EMAIL="${1#*=}"
      shift
      ;;
    --app-port)
      APP_PORT_OVERRIDE="${2:-}"
      shift 2
      ;;
    --app-port=*)
      APP_PORT_OVERRIDE="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Supported options:"
      echo "  --non-interactive"
      echo "  --domains=admin.example.com,hub.example.com"
      echo "  --email=ops@example.com"
      echo "  --app-port=8080"
      exit 1
      ;;
  esac
done

get_node_major_version() {
  if ! command -v node &>/dev/null; then
    return 1
  fi

  node -e "process.stdout.write(process.versions.node.split('.')[0])"
}

require_healthy_dpkg() {
  if ! command -v dpkg &>/dev/null; then
    return 0
  fi

  local audit_output
  audit_output="$(dpkg --audit 2>/dev/null || true)"
  if [[ -n "${audit_output//[[:space:]]/}" ]]; then
    echo "The Debian package manager is blocked by unconfigured packages."
    echo "Fix this state first, then rerun the script."
    echo ""
    echo "$audit_output"
    echo ""
    echo "Suggested command: sudo dpkg --configure -a"
    exit 1
  fi
}

require_apt_ready() {
  if ! command -v apt-get &>/dev/null; then
    return 1
  fi

  require_healthy_dpkg
}

can_use_apt() {
  if ! command -v apt-get &>/dev/null; then
    return 1
  fi

  if ! command -v dpkg &>/dev/null; then
    return 0
  fi

  local audit_output
  audit_output="$(dpkg --audit 2>/dev/null || true)"
  [[ -z "${audit_output//[[:space:]]/}" ]]
}

install_node_binary() {
  local arch node_arch archive_name download_url install_root extracted_dir

  arch="$(uname -m)"
  case "$arch" in
    x86_64)
      node_arch="x64"
      ;;
    aarch64)
      node_arch="arm64"
      ;;
    *)
      echo "Unsupported architecture for automatic Node.js installation: $arch"
      echo "Install Node.js ${NODE_MIN_VERSION}+ manually, then rerun the script."
      exit 1
      ;;
  esac

  archive_name="node-v${NODE_DISTRO_VERSION}-linux-${node_arch}.tar.xz"
  download_url="https://nodejs.org/dist/v${NODE_DISTRO_VERSION}/${archive_name}"
  install_root="/usr/local/lib/nodejs"
  extracted_dir="${install_root}/node-v${NODE_DISTRO_VERSION}-linux-${node_arch}"

  echo "→ Installing Node.js ${NODE_DISTRO_VERSION} from the official binaries..."
  mkdir -p "$install_root"
  rm -rf "$extracted_dir"

  if command -v curl &>/dev/null; then
    curl -fsSL "$download_url" | tar -xJ -C "$install_root"
  elif command -v wget &>/dev/null; then
    wget -qO- "$download_url" | tar -xJ -C "$install_root"
  else
    echo "curl and wget are both unavailable. Install Node.js ${NODE_MIN_VERSION}+ manually."
    exit 1
  fi

  ln -sfn "${extracted_dir}/bin/node" /usr/local/bin/node
  ln -sfn "${extracted_dir}/bin/npm" /usr/local/bin/npm
  ln -sfn "${extracted_dir}/bin/npx" /usr/local/bin/npx
  ln -sfn "${extracted_dir}/bin/corepack" /usr/local/bin/corepack

  local installed_node_version
  installed_node_version="$(get_node_major_version || true)"
  if [[ -z "$installed_node_version" || "$installed_node_version" -lt "$NODE_MIN_VERSION" ]]; then
    echo "Failed to install Node.js ${NODE_MIN_VERSION}+ (detected version: ${installed_node_version:-missing})."
    exit 1
  fi
}

# ── Preflight checks ─────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo bash install.sh)"
  exit 1
fi

# ── Node.js: install automatically if missing or too old ─────────────────────
install_node() {
  if ! can_use_apt; then
    install_node_binary
    return
  fi

  echo "→ Installing Node.js ${NODE_MIN_VERSION} via NodeSource..."
  if command -v curl &>/dev/null; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" | bash -
  elif command -v wget &>/dev/null; then
    wget -qO- "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" | bash -
  else
    echo "curl and wget are both unavailable. Install Node.js ${NODE_MIN_VERSION}+ manually."
    exit 1
  fi
  apt-get install -y nodejs

  local installed_node_version
  installed_node_version="$(get_node_major_version || true)"
  if [[ -z "$installed_node_version" || "$installed_node_version" -lt "$NODE_MIN_VERSION" ]]; then
    echo "Failed to install Node.js ${NODE_MIN_VERSION}+ (detected version: ${installed_node_version:-missing})."
    echo "Check that the NodeSource repository is configured correctly, then rerun the script."
    exit 1
  fi
}

if ! command -v node &>/dev/null; then
  if command -v apt-get &>/dev/null || command -v curl &>/dev/null || command -v wget &>/dev/null; then
    install_node
  else
    echo "Node.js not found. Install Node.js >= ${NODE_MIN_VERSION}, then rerun the script."
    exit 1
  fi
fi

NODE_VERSION="$(get_node_major_version)"
if [[ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]]; then
  echo "Node.js ${NODE_MIN_VERSION}+ required (found: $NODE_VERSION)"
  if command -v apt-get &>/dev/null || command -v curl &>/dev/null || command -v wget &>/dev/null; then
    install_node
  else
    echo "Upgrade Node.js manually, then rerun the script."
    exit 1
  fi
fi

# ── openssl (secret generation) ──────────────────────────────────────────────
if ! command -v openssl &>/dev/null; then
  if require_apt_ready; then
    apt-get install -y openssl
  else
    echo "openssl not found. Install it, then rerun the script."
    exit 1
  fi
fi

install_nginx_and_certbot() {
  if ! require_apt_ready; then
    echo "apt-get is required to install nginx/certbot automatically."
    echo "Install nginx and certbot manually, then rerun the script."
    exit 1
  fi

  echo "→ Installing nginx + certbot..."
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx
  systemctl enable nginx
  systemctl start nginx
}

configure_nginx_site() {
  local domains_csv="$1"
  local port="$2"
  local site_file="/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf"
  local site_link="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}.conf"
  local server_names

  server_names="${domains_csv//,/ }"

  echo "→ Creating nginx site for ${server_names}..."
  cat > "$site_file" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  ln -sfn "$site_file" "$site_link"
  rm -f /etc/nginx/sites-enabled/default

  nginx -t
  systemctl reload nginx
}

detect_existing_https_domain() {
  local site_file="/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf"
  local domain cert_file

  if [[ ! -f "$site_file" ]]; then
    return 1
  fi

  if ! grep -Eq 'listen[[:space:]]+443|ssl_certificate' "$site_file"; then
    return 1
  fi

  domain="$(awk '/server_name/ {
    for (i = 2; i <= NF; i++) {
      gsub(/;/, "", $i)
      if ($i != "_" && $i !~ /^\$/) {
        print $i
        exit
      }
    }
  }' "$site_file")"

  if [[ -z "${domain//[[:space:]]/}" ]]; then
    return 1
  fi

  cert_file="/etc/letsencrypt/live/${domain}/fullchain.pem"
  if [[ -f "$cert_file" ]]; then
    printf '%s\n' "$domain"
    return 0
  fi

  return 1
}

setup_domain_and_tls() {
  local app_port="$1"
  local server_ip email dns_ip certbot_cmd existing_domain
  local domain_input domain normalized domains_csv primary_domain
  local -a domains=()

  if existing_domain="$(detect_existing_https_domain)"; then
    echo "→ Existing nginx + HTTPS configuration detected for ${existing_domain}."
    echo "→ Skipping nginx + certbot setup."
    return
  fi

  if [[ -n "${DOMAINS_CSV//[[:space:]]/}" ]]; then
    domain_input="$DOMAINS_CSV"
  elif [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    echo "→ Non-interactive mode with no --domains provided: skipping nginx + certbot setup."
    return
  else
    echo ""
    echo "Do you want to configure a domain with nginx + HTTPS now? [y/N]"
    read -r domain_choice

    case "${domain_choice,,}" in
      y|yes)
        ;;
      *)
        echo "→ Skipping nginx + certbot setup."
        return
        ;;
    esac

    echo "Enter domain(s) to use (comma-separated, example: admin.example.com,hub.example.com):"
    read -r domain_input
  fi

  if [[ -z "${domain_input//[[:space:]]/}" ]]; then
    echo "No domain provided. Skipping nginx + certbot setup."
    return
  fi

  IFS=',' read -r -a raw_domains <<< "$domain_input"
  for domain in "${raw_domains[@]}"; do
    normalized="$(echo "$domain" | tr '[:upper:]' '[:lower:]' | xargs)"
    [[ -z "$normalized" ]] && continue
    if [[ "$normalized" =~ [[:space:]] ]]; then
      continue
    fi
    if [[ ! "$normalized" =~ ^[a-z0-9.-]+$ || "$normalized" == .* || "$normalized" == *. || "$normalized" != *.* ]]; then
      echo "Warning: ignoring invalid domain '${domain}'."
      continue
    fi
    domains+=("$normalized")
  done

  if [[ "${#domains[@]}" -eq 0 ]]; then
    echo "No valid domain provided. Skipping nginx + certbot setup."
    return
  fi

  domains=( $(printf "%s\n" "${domains[@]}" | awk '!seen[$0]++') )
  domains_csv="$(IFS=','; echo "${domains[*]}")"
  primary_domain="${domains[0]}"

  install_nginx_and_certbot
  configure_nginx_site "$domains_csv" "$app_port"

  server_ip="$(hostname -I | awk '{print $1}')"
  for domain in "${domains[@]}"; do
    dns_ip="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}')"

    if [[ -n "$dns_ip" && -n "$server_ip" && "$dns_ip" != "$server_ip" ]]; then
      echo "Warning: ${domain} resolves to ${dns_ip}, but this server IP is ${server_ip}."
      echo "HTTPS issuance may fail until DNS points to this server."
      if [[ "$NON_INTERACTIVE" -eq 0 ]]; then
        echo "Press Enter to continue anyway, or Ctrl+C to cancel."
        read -r
      fi
    fi
  done

  if [[ -n "${LETSENCRYPT_EMAIL//[[:space:]]/}" ]]; then
    email="$LETSENCRYPT_EMAIL"
  elif [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    email=""
  else
    echo "Enter an email for Let's Encrypt notices (leave empty to skip email):"
    read -r email
  fi

  certbot_cmd=(certbot --nginx --redirect --agree-tos -n --expand --cert-name "${primary_domain}")
  for domain in "${domains[@]}"; do
    certbot_cmd+=( -d "$domain" )
  done
  if [[ -n "${email//[[:space:]]/}" ]]; then
    certbot_cmd+=( -m "$email" )
  else
    certbot_cmd+=( --register-unsafely-without-email )
  fi

  echo "→ Requesting HTTPS certificate with certbot..."
  if ! "${certbot_cmd[@]}"; then
    echo "Certbot failed."
    echo "You can retry manually once DNS is ready:"
    echo "  certbot --nginx -d ${primary_domain} --redirect"
    return
  fi

  systemctl reload nginx
  echo "✓ Domain configured with HTTPS: https://${primary_domain}"
}

# ── Internet access for npm ──────────────────────────────────────────────────

# -- Build tools (required by better-sqlite3 native addon) --------------------
# better-sqlite3 compiles a C++ extension during npm install.
need_build_tools=0
command -v python3 &>/dev/null || need_build_tools=1
command -v make    &>/dev/null || need_build_tools=1
command -v g++     &>/dev/null || need_build_tools=1

if [[ $need_build_tools -eq 1 ]]; then
  if require_apt_ready; then
    echo "→ Installing build tools (python3, make, g++ — required by the native SQLite module)..."
    apt-get install -y python3 make g++ &>/dev/null
    echo "✓ Build tools installed"
  else
    echo "Warning: python3, make and g++ are required to compile the native SQLite module."
    echo "Install build-essential (or equivalent), then rerun the script."
    echo "Press Enter to continue, or Ctrl+C to cancel."
    read -r
  fi
else
  echo "✓ Build tools detected (python3 / make / g++)"
fi
if ! curl -fsSL --max-time 5 https://registry.npmjs.org/ &>/dev/null \
  && ! wget -q --timeout=5 --spider https://registry.npmjs.org/ &>/dev/null; then
  echo "Warning: registry.npmjs.org is unreachable. npm install may fail."
  echo "Press Ctrl+C to cancel, or Enter to continue anyway."
  read -r
fi

# ── Copy sources ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [[ ! -d "$SCRIPT_DIR/backend" || ! -d "$SCRIPT_DIR/frontend" ]]; then
  echo "ServerHub sources not found next to the script."
  echo "This script must be placed and run from the project root containing:"
  echo "  - backend/"
  echo "  - frontend/"
  echo "Detected path: $SCRIPT_DIR"
  exit 1
fi

echo "→ Copying files to ${APP_DIR}..."
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

# ── Install dependencies ─────────────────────────────────────────────────────
echo "→ Installing backend dependencies (including build tools)..."
cd "$APP_DIR/backend"
npm install

echo "→ Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

run_npm_audit_fix() {
  local target_dir="$1"
  local label="$2"

  echo "→ Running npm audit fix for ${label}..."
  cd "$target_dir"
  if ! npm audit fix; then
    echo "Warning: npm audit fix failed for ${label}. Continuing installation."
  fi
}

run_npm_audit_fix "$APP_DIR/backend" "backend"
run_npm_audit_fix "$APP_DIR/frontend" "frontend"

# ── Build ────────────────────────────────────────────────────────────────────
echo "→ Building frontend..."
cd "$APP_DIR/frontend"
npm run build

echo "→ Building backend..."
cd "$APP_DIR/backend"
npm run build

echo "→ Pruning backend development dependencies..."
cd "$APP_DIR/backend"
npm prune --omit=dev

# ── .env file ────────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  GENERATED_PASS=$(openssl rand -hex 12)
  echo "→ Creating .env file..."
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=8080

# !! Change these values before exposing ServerHub to the internet !!
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${GENERATED_PASS}

# Leave empty in standalone mode (the frontend is served by the same process)
CORS_ORIGINS=

# MySQL — optional, ServerHub connects to it on demand (no local server required)
# MYSQL_HOST=127.0.0.1
# MYSQL_PORT=3306
# MYSQL_USER=root
# MYSQL_PASSWORD=

# PostgreSQL — same idea
# PG_HOST=127.0.0.1
# PG_PORT=5432
# PG_USER=postgres
# PG_PASSWORD=

FILES_ROOT=/var/www
EOF

  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║  Credentials generated automatically     ║"
  echo "  ║  Login: admin                            ║"
  echo "  ║  Password: ${GENERATED_PASS}  ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo "  Full config: ${ENV_FILE}"
  echo ""
fi

# ── systemd service ──────────────────────────────────────────────────────────
echo "→ Creating systemd service (auto-start on boot)..."
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

# ── Result ───────────────────────────────────────────────────────────────────
PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 || echo "8080")
if [[ -n "${APP_PORT_OVERRIDE//[[:space:]]/}" ]]; then
  PORT="$APP_PORT_OVERRIDE"
fi
SERVER_IP=$(hostname -I | awk '{print $1}')

setup_domain_and_tls "$PORT"

echo ""
echo "✓ ServerHub installed and started."
echo ""
echo "  → http://${SERVER_IP}:${PORT}"
echo ""
echo "  Useful commands:"
echo "    journalctl -u ${SERVICE_NAME} -f          # live logs"
echo "    systemctl status ${SERVICE_NAME}           # service status"
echo "    systemctl restart ${SERVICE_NAME}          # restart"
echo "    bash ${APP_DIR}/update.sh                 # update"
echo ""