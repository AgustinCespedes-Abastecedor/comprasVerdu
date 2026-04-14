#!/usr/bin/env bash
# =============================================================================
# Elimina contenedores que bloquean `docker compose up` por nombre duplicado.
# Cubre nombres fijos (compras_verdu_*) y prefijos de proyecto antiguos
# (*_compras_verdu_*), típicos cuando el nombre del proyecto de Compose era un hash.
#
# Uso (desde la raíz del repo, una vez si aparece "container name is already in use"):
#   ./scripts/cleanup-legacy-compose-containers.sh
#
# No borra volúmenes ni imágenes. No afecta a otros proyectos Docker salvo que
# compartan exactamente esos substrings en el nombre (muy improbable).
# =============================================================================
set -euo pipefail

patterns=(
  "compras_verdu_db"
  "compras_verdu_backend"
  "compras_verdu_frontend"
)

for p in "${patterns[@]}"; do
  ids=$(docker ps -aq --filter "name=${p}" 2>/dev/null || true)
  if [[ -n "${ids}" ]]; then
    echo "[cleanup] Eliminando contenedores que coinciden con name=*${p}* ..."
    # shellcheck disable=SC2086
    docker rm -f ${ids}
  fi
done

echo "[cleanup] Listo. Ejecutá: docker compose up -d --build"
