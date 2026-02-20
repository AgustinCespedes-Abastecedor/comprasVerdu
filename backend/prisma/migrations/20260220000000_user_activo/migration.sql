-- AlterTable: soft delete para usuarios (suspender / inactivos)
ALTER TABLE "User" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
