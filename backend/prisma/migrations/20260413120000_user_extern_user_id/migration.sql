-- Vínculo con Usuarios de ELABASTECEDOR (login y Nivel en SQL Server; Postgres solo vínculo operativo).
ALTER TABLE "User" ADD COLUMN "externUserId" TEXT;

CREATE UNIQUE INDEX "User_externUserId_key" ON "User"("externUserId");
