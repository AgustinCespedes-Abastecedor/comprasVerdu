-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'COMPRADOR', 'VISOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'COMPRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigoExterno" TEXT,
    "idExterno" TEXT,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoExterno" TEXT,
    "descripcion" TEXT NOT NULL,
    "stockSucursales" INTEGER NOT NULL DEFAULT 0,
    "stockCD" INTEGER NOT NULL DEFAULT 0,
    "ventasN1" INTEGER NOT NULL DEFAULT 0,
    "ventasN2" INTEGER NOT NULL DEFAULT 0,
    "ventas7dias" INTEGER NOT NULL DEFAULT 0,
    "costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margenPorc" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "numeroCompra" INTEGER,
    "fecha" DATE NOT NULL,
    "totalBultos" INTEGER NOT NULL DEFAULT 0,
    "totalMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompra" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "bultos" INTEGER NOT NULL DEFAULT 0,
    "precioPorBulto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pesoPorBulto" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "precioPorKg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recepcion" (
    "id" TEXT NOT NULL,
    "numeroRecepcion" INTEGER,
    "compraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleRecepcion" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "detalleCompraId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "uxb" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DetalleRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_codigoExterno_key" ON "Proveedor"("codigoExterno");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoExterno_key" ON "Producto"("codigoExterno");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_numeroCompra_key" ON "Compra"("numeroCompra");

-- CreateIndex
CREATE INDEX "Compra_fecha_idx" ON "Compra"("fecha");

-- CreateIndex
CREATE INDEX "Compra_userId_idx" ON "Compra"("userId");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_numeroRecepcion_key" ON "Recepcion"("numeroRecepcion");

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_compraId_key" ON "Recepcion"("compraId");

-- CreateIndex
CREATE INDEX "Recepcion_compraId_idx" ON "Recepcion"("compraId");

-- CreateIndex
CREATE INDEX "Recepcion_userId_idx" ON "Recepcion"("userId");

-- CreateIndex
CREATE INDEX "Recepcion_createdAt_idx" ON "Recepcion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleRecepcion_detalleCompraId_key" ON "DetalleRecepcion"("detalleCompraId");

-- CreateIndex
CREATE INDEX "DetalleRecepcion_recepcionId_idx" ON "DetalleRecepcion"("recepcionId");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecepcion" ADD CONSTRAINT "DetalleRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecepcion" ADD CONSTRAINT "DetalleRecepcion_detalleCompraId_fkey" FOREIGN KEY ("detalleCompraId") REFERENCES "DetalleCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
