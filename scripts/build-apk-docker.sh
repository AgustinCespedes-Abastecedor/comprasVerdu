#!/usr/bin/env bash
# Compila la APK en Docker (Node 22 + JDK + Android SDK dentro de la imagen).
# No requiere Node 22 ni Android SDK en el host; solo Docker.
# Uso desde la raíz del repo: npm run apk:docker
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "[apk:docker] No se encontró el comando 'docker'. Instalá Docker Engine y volvé a intentar."
  echo ""
  exit 1
fi

IMAGE="${APK_DOCKER_IMAGE:-comprasverdu-apk:debug}"
OUT="${REPO_ROOT}/frontend/app-debug.apk"

echo "[apk:docker] Construyendo imagen ${IMAGE} (contexto: frontend/)…"
docker build -f frontend/docker/apk/Dockerfile -t "${IMAGE}" frontend

echo "[apk:docker] Extrayendo APK al host…"
CID="$(docker create "${IMAGE}")"
docker cp "${CID}:/app/android/app/build/outputs/apk/debug/app-debug.apk" "${OUT}"
docker rm "${CID}" >/dev/null

echo ""
echo "[apk:docker] Listo: ${OUT}"
echo ""
