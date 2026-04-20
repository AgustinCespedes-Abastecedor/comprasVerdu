/**
 * @param {unknown} uxbBruto
 * @param {unknown} pesoCajonKg
 * @returns {number}
 */
export function uxbNetoParaCosto(uxbBruto, pesoCajonKg) {
  const bruto = Number(uxbBruto) || 0;
  const cajon = Number(pesoCajonKg) || 0;
  const neto = bruto - cajon;
  return neto > 0 ? neto : 0;
}

/**
 * UxB bruto > 0 pero no supera el peso del cajón (sin kg útiles para costo).
 * @param {unknown} uxbBruto
 * @param {unknown} pesoCajonKg
 */
export function recepcionUxBBrutoInvalidoVsCajon(uxbBruto, pesoCajonKg) {
  const bruto = Number(uxbBruto) || 0;
  if (bruto <= 0) return false;
  return uxbNetoParaCosto(bruto, pesoCajonKg) <= 0;
}

/**
 * @param {unknown} precioPorBulto
 * @param {unknown} uxbBruto
 * @param {unknown} pesoCajonKg
 * @returns {number | null}
 */
export function costoPorUnidadRecepcion(precioPorBulto, uxbBruto, pesoCajonKg) {
  const neto = uxbNetoParaCosto(uxbBruto, pesoCajonKg);
  const p = Number(precioPorBulto) || 0;
  if (neto <= 0 || p <= 0) return null;
  return p / neto;
}
