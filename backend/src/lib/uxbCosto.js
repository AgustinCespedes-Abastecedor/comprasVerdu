/**
 * UxB en recepción = peso bruto por bulto (kg). El peso del cajón (kg, desde la compra) no es mercadería:
 * costo por kg vendible = precioPorBulto / (UxB bruto - pesoCajon).
 *
 * Límite alineado con Prisma @db.Decimal(8, 2) en DetalleCompra.pesoCajon.
 */
export const PESO_CAJON_MAX_KG = 999999.99;

export function normalizarPesoCajonKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(PESO_CAJON_MAX_KG, n);
}

export function uxbNetoParaCosto(uxbBruto, pesoCajonKg) {
  const bruto = Number(uxbBruto) || 0;
  const cajon = Number(pesoCajonKg) || 0;
  const neto = bruto - cajon;
  return neto > 0 ? neto : 0;
}

/**
 * Hay UxB bruto cargado pero no alcanza para cubrir el peso del cajón (no hay kg útiles).
 * @param {unknown} uxbBruto
 * @param {unknown} pesoCajonKg
 */
export function recepcionUxBBrutoInvalidoVsCajon(uxbBruto, pesoCajonKg) {
  const bruto = Number(uxbBruto) || 0;
  if (bruto <= 0) return false;
  return uxbNetoParaCosto(bruto, pesoCajonKg) <= 0;
}

export function costoPorUnidadDesdeBulto(precioPorBulto, uxbBruto, pesoCajonKg) {
  const neto = uxbNetoParaCosto(uxbBruto, pesoCajonKg);
  const p = Number(precioPorBulto) || 0;
  if (neto <= 0 || p <= 0) return 0;
  return p / neto;
}
