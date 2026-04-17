/**
 * Recorre todas las páginas de un endpoint paginado hasta reunir `total` ítems o una página vacía.
 * @template T
 * @param {(args: { page: number, pageSize: number }) => Promise<{ items?: T[], total?: number }>} fetchPage
 * @param {{ pageSize?: number, maxItems?: number }} [opts]
 * @returns {Promise<T[]>}
 */
export async function fetchAllPagedItems(fetchPage, opts = {}) {
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 100));
  const maxItems = opts.maxItems ?? 100_000;
  const all = [];
  let page = 1;
  while (all.length < maxItems) {
    const res = await fetchPage({ page, pageSize });
    const items = Array.isArray(res?.items) ? res.items : [];
    const total = typeof res?.total === 'number' ? res.total : items.length;
    all.push(...items);
    if (items.length === 0 || items.length < pageSize || all.length >= total) break;
    page += 1;
  }
  return all;
}
