/** Paginación offset para listados (compras, recepciones, usuarios, etc.). */

export const DEFAULT_LIST_PAGE_SIZE = 25;
export const MAX_LIST_PAGE_SIZE = 100;

/**
 * @param {Record<string, unknown>} query - req.query de Express
 * @returns {{ page: number, pageSize: number, skip: number }}
 */
export function parseOffsetPagination(query) {
  const pageRaw = query?.page;
  const pageSizeRaw = query?.pageSize;
  const page = Math.max(1, parseInt(String(pageRaw ?? ''), 10) || 1);
  const pageSize = Math.min(
    MAX_LIST_PAGE_SIZE,
    Math.max(1, parseInt(String(pageSizeRaw ?? ''), 10) || DEFAULT_LIST_PAGE_SIZE),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** true si el cliente pidió envelope paginado (page explícito en query). */
export function wantsPagedEnvelope(query) {
  return query?.page != null && String(query.page).trim() !== '';
}
