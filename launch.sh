#!/usr/bin/env bash
# ServerHub - Start the service only when it is not already running.
# Usage: sudo bash launch.sh
set -euo pipefail

readonly SERVICE_NAME="serverhub"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo bash launch.sh)"
  exit 1
fi

if ! systemctl cat "$SERVICE_NAME" &>/dev/null; then
  echo "ServerHub is not installed as a systemd service. Run install.sh first."
  exit 1
fi

if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "ServerHub is already running."
  exit 0
fi

echo "Starting ServerHub..."
systemctl start "$SERVICE_NAME"

if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "ServerHub started successfully."
else
  echo "ServerHub failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50"
  exit 1
fi