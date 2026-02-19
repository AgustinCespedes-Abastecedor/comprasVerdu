-- CreateTable: roles con permisos por pantalla (ABM desde gestión de usuarios)
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_nombre_key" ON "Role"("nombre");

-- Insertar roles por defecto (Administrador, Comprador, Visor)
INSERT INTO "Role" ("id", "nombre", "descripcion", "permisos", "createdAt", "updatedAt") VALUES
('rol_admin_001', 'Administrador', 'Acceso total: todas las pantallas y gestión de usuarios y roles', '["home","comprar","ver-compras","recepcion","ver-recepciones","info-final-articulos","gestion-usuarios","gestion-roles"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rol_comp_002', 'Comprador', 'Puede cargar compras y ver historial. No gestiona usuarios.', '["home","comprar","ver-compras","recepcion","ver-recepciones","info-final-articulos"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rol_visor_003', 'Visor', 'Solo lectura: ver compras y recepciones.', '["home","ver-compras","ver-recepciones","info-final-articulos"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Añadir roleId a User y migrar datos
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

UPDATE "User" SET "roleId" = 'rol_admin_001' WHERE "rol" = 'ADMIN';
UPDATE "User" SET "roleId" = 'rol_comp_002' WHERE "rol" = 'COMPRADOR';
UPDATE "User" SET "roleId" = 'rol_visor_003' WHERE "rol" = 'VISOR';

-- Si algún usuario quedó sin roleId (datos raros), asignar Comprador
UPDATE "User" SET "roleId" = 'rol_comp_002' WHERE "roleId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quitar columna rol y enum
ALTER TABLE "User" DROP COLUMN "rol";
DROP TYPE "RolUsuario";
