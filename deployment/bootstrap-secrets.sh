#!/usr/bin/env bash
set -euo pipefail

# Genera secretos y los guarda en la raíz del repo (.env) para Docker Compose.
# NO commitear el .env. (El .gitignore ya lo excluye.)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
    return
  fi
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
}

ensure_kv() {
  local key="$1"
  local value="$2"
  if [ -f "$ENV_FILE" ] && grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
    return 0
  fi
  echo "${key}=${value}" >> "$ENV_FILE"
}

touch "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

if ! grep -qE "^[[:space:]]*JWT_SECRET=" "$ENV_FILE"; then
  ensure_kv "JWT_SECRET" "$(gen_secret)"
fi

if ! grep -qE "^[[:space:]]*TABLERO_SSO_SECRET=" "$ENV_FILE"; then
  ensure_kv "TABLERO_SSO_SECRET" "$(gen_secret)"
fi

echo "[ok] Secrets listos en $ENV_FILE"
