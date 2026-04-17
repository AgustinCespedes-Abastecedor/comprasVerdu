/**
 * Formato breve de importes para notificaciones (es-AR).
 * @param {unknown} value Decimal o número de Prisma
 * @returns {string}
 */
export function formatMontoNotificacion(value) {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : value != null && typeof value.toString === 'function'
        ? parseFloat(String(value))
        : NaN;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Título compacto con datos primarios: nº compra, proveedor, bultos.
 * @param {{ numeroCompra?: number | null, proveedorNombre: string, totalBultos: number }} p
 */
export function tituloCompraProveedorBultos(p) {
  const nro =
    p.numeroCompra != null && p.numeroCompra !== ''
      ? `#${p.numeroCompra}`
      : 's/n';
  const prov = (p.proveedorNombre || 'Proveedor').trim() || 'Proveedor';
  const b = Number(p.totalBultos) || 0;
  return `Compra ${nro} · ${prov} · ${b} bultos`;
}

/**
 * Recepción: nº recepción, nº compra, proveedor, bultos pedido (compra).
 */
export function tituloRecepcionCompraProveedorBultos(p) {
  const nr =
    p.numeroRecepcion != null && p.numeroRecepcion !== ''
      ? `#${p.numeroRecepcion}`
      : 's/n';
  const nc =
    p.numeroCompra != null && p.numeroCompra !== ''
      ? `#${p.numeroCompra}`
      : 's/n';
  const prov = (p.proveedorNombre || 'Proveedor').trim() || 'Proveedor';
  const b = Number(p.totalBultos) || 0;
  return `Recepción ${nr} · Compra ${nc} · ${prov} · ${b} bultos pedido`;
}

/**
 * Crea la misma notificación in-app para cada usuario activo (incluido quien disparó el evento).
 * Así funciona con un solo usuario en localhost y en equipos chicos.
 * `actorUserId` se usa solo para logs estructurados.
 * Errores típicos: tabla ausente (migración pendiente) → log claro.
 */
export async function notifyAllActiveUsers(prisma, {
  type,
  title,
  message,
  compraId = null,
  recepcionId = null,
  actorUserId = null,
}) {
  const targets = await prisma.user.findMany({
    where: { activo: true },
    select: { id: true },
  });

  if (targets.length === 0) {
    console.warn('[NOTIF] No hay usuarios activos; no se crean notificaciones.', { type, actorUserId });
    return;
  }

  try {
    const { count } = await prisma.userNotification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type,
        title,
        message,
        compraId,
        recepcionId,
      })),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.info('[NOTIF] createMany OK', { type, filas: count, destinatarios: targets.length, actorUserId });
    }
  } catch (err) {
    const hint =
      err?.code === 'P2021' || /does not exist|relation|UserNotification/i.test(String(err?.message))
        ? ' ¿Ejecutaste prisma migrate (tabla UserNotification)?'
        : '';
    console.error('[NOTIF] createMany falló:', err?.message || err, hint);
    throw err;
  }
}
