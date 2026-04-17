/**
 * Normaliza la respuesta de GET /users (envelope paginado o array legacy).
 * @param {unknown} data
 * @returns {{ items: Array<Record<string, unknown>>, total: number }}
 */
export function normalizeUsersListPayload(data) {
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return {
      items: data.items,
      total: typeof data.total === 'number' ? data.total : data.items.length,
    };
  }
  const arr = Array.isArray(data) ? data : [];
  return { items: arr, total: arr.length };
}

/** Usuarios con cuenta en la app (id no nulo), aptos para filtro por userId en logs. */
export function usersWithAppId(items) {
  return (Array.isArray(items) ? items : []).filter((u) => u && u.id != null && String(u.id).trim() !== '');
}
