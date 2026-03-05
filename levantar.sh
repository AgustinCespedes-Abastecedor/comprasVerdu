#!/usr/bin/env bash
# =============================================================================
# Levantar Compras Verdu (Ubuntu/Linux)
# Ejecutar desde la raíz del proyecto:   ./levantar.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "============================================"
echo "  Compras Verdu - Levantar con Docker"
echo "============================================"
echo ""
echo "Proyecto: $SCRIPT_DIR"
echo ""

if ! command -v docker &> /dev/null; then
  echo "[ERROR] Docker no está instalado o no está en el PATH."
  echo "Instalá Docker según la documentación del proyecto."
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "[ERROR] Docker Compose (plugin) no está disponible."
  echo "Instalá: sudo apt install docker-compose-plugin"
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "No existe .env. Se crea a partir de .env.example."
    cp .env.example .env
    echo ""
    echo "IMPORTANTE: Editá el archivo .env y configurá al menos:"
    echo "  - JWT_SECRET    (clave segura en producción)"
    echo "  - FRONTEND_URL  (ej. http://TU_IP:8081)"
    echo "  - EXTERNAL_DB_* (si usás integración con El Abastecedor)"
    echo ""
    echo "Ver docs/ENV.md para diferencias con el .env de Ticketador."
    echo ""
    echo "Cuando termines, ejecutá de nuevo: ./levantar.sh"
    exit 0
  else
    echo "[ERROR] No existe .env ni .env.example en esta carpeta."
    exit 1
  fi
fi

echo "Levantando servicios (db, backend, frontend)..."
echo ""
docker compose up -d --build

echo ""
echo "============================================"
echo "  Proyecto levantado"
echo "============================================"
echo ""
echo "  Ver estado:    docker compose ps"
echo "  Ver logs:      docker compose logs -f"
echo "  Detener:       ./detener.sh   (o docker compose down)"
echo ""
echo "  Acceso: http://localhost:8081  (o la URL de FRONTEND_URL en .env)"
echo ""
