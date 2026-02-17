import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashDevAdmin = await bcrypt.hash('admin1234', 10);

  await prisma.user.upsert({
    where: { email: 'a.cespedes@elabastecedor.com.ar' },
    update: { password: hashDevAdmin, nombre: 'Dev El Abastecedor', rol: 'ADMIN' },
    create: {
      email: 'a.cespedes@elabastecedor.com.ar',
      password: hashDevAdmin,
      nombre: 'Dev El Abastecedor',
      rol: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'comprador@comprasverdu.com' },
    update: {},
    create: {
      email: 'comprador@comprasverdu.com',
      password: hashAdmin,
      nombre: 'Usuario Comprador',
      rol: 'COMPRADOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'visor@comprasverdu.com' },
    update: {},
    create: {
      email: 'visor@comprasverdu.com',
      password: hashAdmin,
      nombre: 'Usuario Visor',
      rol: 'VISOR',
    },
  });

  const proveedores = [
    { codigoExterno: 'seed-1', nombre: 'Mercado central 1' },
    { codigoExterno: 'seed-2', nombre: 'Mercado central 2' },
  ];
  for (const p of proveedores) {
    await prisma.proveedor.upsert({
      where: { codigoExterno: p.codigoExterno },
      update: { nombre: p.nombre },
      create: p,
    });
  }

  const productos = [
    { codigo: '3004', descripcion: 'BANANA ECUADOR XKG', stockSucursales: 10, stockCD: 5, ventasN1: 8, ventasN2: 7, ventas7dias: 50, costo: 2500, precioVenta: 2800, margenPorc: 12 },
    { codigo: '2069', descripcion: 'TOMATE XKG', stockSucursales: 15, stockCD: 8, ventasN1: 12, ventasN2: 10, ventas7dias: 75, costo: 1200, precioVenta: 1500, margenPorc: 25 },
    { codigo: '2050', descripcion: 'MORRON ROJO XKG', stockSucursales: 6, stockCD: 4, ventasN1: 5, ventasN2: 4, ventas7dias: 30, costo: 1800, precioVenta: 2200, margenPorc: 22 },
    { codigo: '3065', descripcion: 'MANZANA GAUCHO XKG', stockSucursales: 20, stockCD: 10, ventasN1: 15, ventasN2: 14, ventas7dias: 90, costo: 900, precioVenta: 1200, margenPorc: 33 },
    { codigo: '996', descripcion: 'MELON X KG', stockSucursales: 8, stockCD: 6, ventasN1: 6, ventasN2: 5, ventas7dias: 40, costo: 600, precioVenta: 850, margenPorc: 42 },
  ];
  for (const prod of productos) {
    await prisma.producto.upsert({
      where: { codigoExterno: prod.codigo },
      update: { descripcion: prod.descripcion },
      create: { ...prod, codigoExterno: prod.codigo },
    });
  }

  console.log('Seed ejecutado correctamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
