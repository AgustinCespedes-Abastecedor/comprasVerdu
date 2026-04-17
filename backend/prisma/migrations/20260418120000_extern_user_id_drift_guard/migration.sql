-- Guarda bases donde "externUserId" ya existía antes de registrar la migración 20260413120000
-- (deploy fallido P3018 / Postgres 42701). No altera el esquema si ya está alineado.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_externUserId_key" ON "User"("externUserId");
