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

if [ ! -f env ] && [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "No existe env ni .env. Se crea .env a partir de .env.example."
    cp .env.example .env
    echo ""
    echo "IMPORTANTE: Editá .env (o creá el archivo versionado env) y configurá:"
    echo "  - JWT_SECRET, FRONTEND_URL, EXTERNAL_DB_* y EXTERNAL_AUTH_LOGIN=true si usás SQL Server"
    echo ""
    echo "Ver docs/ENV.md. Cuando termines: ./levantar.sh"
    exit 0
  else
    echo "[ERROR] No existe env, .env ni .env.example."
    exit 1
  fi
fi

echo "Inicializando secretos (JWT + SSO Tablero) si faltan..."
./deployment/bootstrap-secrets.sh
echo ""

echo "Levantando servicios (db, backend, frontend)..."
if [ -f env ]; then
  echo "(variables Compose: archivo env)"
else
  echo "(variables Compose: archivo .env)"
fi
echo ""
./scripts/docker-compose-env.sh up -d --build

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
