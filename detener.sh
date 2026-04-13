#!/usr/bin/env bash
# =============================================================================
# Detener Compras Verdu (Ubuntu/Linux)
# Ejecutar desde la raíz del proyecto:   ./detener.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "Deteniendo contenedores de Compras Verdu..."
echo ""
./scripts/docker-compose-env.sh down
echo ""
echo "Proyecto detenido. Para volver a levantarlo: ./levantar.sh"
echo ""
