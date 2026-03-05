#!/usr/bin/env bash
# =============================================================================
# Instalar servicio systemd para arranque automático al reiniciar el SO
# Ejecutar desde la raíz del proyecto:  sudo ./deployment/instalar-servicio.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_DIR="/etc/systemd/system"
PLACEHOLDER="/home/adm_agustin/comprasVerdu"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá con sudo: sudo $0"
  exit 1
fi

echo "Proyecto: $PROJECT_DIR"
echo "Instalando servicios en $SERVICE_DIR..."
echo ""

sed "s|$PLACEHOLDER|$PROJECT_DIR|g" \
  "$SCRIPT_DIR/compras-verdu.service" > "$SERVICE_DIR/compras-verdu.service"

sed "s|$PLACEHOLDER|$PROJECT_DIR|g" \
  "$SCRIPT_DIR/compras-verdu-watchdog.service" > "$SERVICE_DIR/compras-verdu-watchdog.service"

cp "$SCRIPT_DIR/compras-verdu-watchdog.timer" "$SERVICE_DIR/"

systemctl daemon-reload

systemctl enable compras-verdu.service
echo "  [OK] compras-verdu.service habilitado (arranque al boot)"

read -p "¿Habilitar watchdog (compose up -d cada 5 min)? [s/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[sS]$ ]]; then
  systemctl enable compras-verdu-watchdog.timer
  systemctl start compras-verdu-watchdog.timer
  echo "  [OK] compras-verdu-watchdog.timer habilitado e iniciado"
else
  echo "  Watchdog no instalado. Podés habilitarlo después con:"
  echo "    sudo systemctl enable compras-verdu-watchdog.timer && sudo systemctl start compras-verdu-watchdog.timer"
fi

echo ""
echo "Listo. Al reiniciar el equipo Compras Verdu se levantará solo."
echo "Comandos útiles:"
echo "  sudo systemctl status compras-verdu"
echo "  sudo systemctl start compras-verdu"
echo "  sudo systemctl stop compras-verdu"
echo ""
