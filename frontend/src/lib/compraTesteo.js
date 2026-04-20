/**
 * Compras con número 1–10 se consideran de testeo (marca TESTEO en listados).
 * @param {{ numeroCompra?: number | null } | null | undefined} compra
 */
export function esCompraNumeroTesteo(compra) {
  const n = Number(compra?.numeroCompra);
  return Number.isFinite(n) && n >= 1 && n <= 10;
}
