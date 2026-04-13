#!/usr/bin/env bash
# =============================================================================
# Ejecuta docker compose con el archivo de entorno correcto para sustitución
# de variables (${EXTERNAL_AUTH_LOGIN}, etc.):
#   1) env   (nombre usado en este repo, versionado)
#   2) .env  (convención estándar de Docker Compose)
#   3) sin --env-file (solo variables del shell)
# Uso desde la raíz: ./scripts/docker-compose-env.sh up -d --build
# =============================================================================
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f env ]]; then exec docker compose --env-file env "$@"; fi
if [[ -f .env ]]; then exec docker compose --env-file .env "$@"; fi
exec docker compose "$@"
