const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('compras_verdu_token');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Error de red');
  return data;
}

export const auth = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  registro: (body) => api('/auth/registro', { method: 'POST', body: JSON.stringify(body) }),
  me: () => api('/auth/me'),
};

export const proveedores = {
  list: () => api('/proveedores'),
};

export const productos = {
  /** Lista paginada: { total, page, pageSize, items }. Params: proveedorId, fecha, page, pageSize, q, sortBy, sortDir */
  list: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '')
    );
    const q = new URLSearchParams(clean).toString();
    return api(`/productos${q ? `?${q}` : ''}`);
  },
};

export const compras = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(`/compras${q ? `?${q}` : ''}`);
  },
  totalesDia: (fecha) => api(`/compras/totales-dia?fecha=${fecha || ''}`),
  create: (body) => api('/compras', { method: 'POST', body: JSON.stringify(body) }),
  get: (id) => api(`/compras/${id}`),
};

export const users = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(`/users${q ? `?${q}` : ''}`);
  },
  create: (body) => api('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
