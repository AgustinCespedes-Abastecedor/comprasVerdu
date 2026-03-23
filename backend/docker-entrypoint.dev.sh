#!/bin/sh
set -e
cd /app
if [ ! -d node_modules/.prisma/client ]; then
  echo "[docker-dev backend] Instalando dependencias y generando Prisma..."
  npm ci
  npx prisma generate
fi
echo "[docker-dev backend] Aplicando migraciones..."
npx prisma migrate deploy
exec npm run dev
