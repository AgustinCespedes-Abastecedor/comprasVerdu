// Navegador: usa /api (proxy de Vite → localhost:4000). Capacitor/móvil: usa VITE_API_URL (URL completa).
import { Capacitor } from '@capacitor/core';

const getApiBase = () => {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_URL || 'http://192.168.1.110:4000/api';
  }
  return '/api';
};
const API_BASE = getApiBase();

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
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.error || data.message || res.statusText || 'Error de red';
    if (data.detail) msg = `${msg}: ${data.detail}`;
    if ((res.status === 500 || res.status === 502 || res.status === 503) && !data.error && !data.message) {
      msg = 'Servidor no disponible. Revisá la conexión o intentá más tarde.';
    }
    if (res.status === 404 && !data.error && !data.message) {
      msg = 'Ruta no encontrada. Verificá que el backend esté corriendo (puerto 4000).';
    }
    const err = new Error(msg);
    err.status = res.status;
    if (data.code && typeof data.code === 'string') err.code = data.code;
    throw err;
  }
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
  /** Lista paginada: { total, page, pageSize, items }. Params (proveedorId opcional): fecha, page, pageSize, q, sortBy, sortDir */
  list: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '')
    );
    const q = new URLSearchParams(clean).toString();
    return api(`/productos${q ? `?${q}` : ''}`);
  },
  /** Porcentaje IVA por código desde ELABASTECEDOR. codigos: string[] → { [codigo]: number } */
  getIva: (codigos) => {
    if (!Array.isArray(codigos) || codigos.length === 0) return Promise.resolve({});
    const q = new URLSearchParams({ codigos: codigos.join(',') }).toString();
    return api(`/productos/iva?${q}`);
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
  getRecepcion: (compraId) => api(`/compras/${compraId}/recepcion`),
};

export const recepciones = {
  list: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api(`/recepciones${q ? `?${q}` : ''}`);
  },
  save: (body) => api('/recepciones', { method: 'POST', body: JSON.stringify(body) }),
  /** Actualizar precio de venta por detalle; body: { detalles: [{ id: detalleRecepcionId, precioVenta }] } */
  updatePrecios: (id, body) => api(`/recepciones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const infoFinalArticulos = {
  /** Lista artículos recepcionados en la fecha (YYYY-MM-DD), con info Tecnolar y costo ponderado */
  list: (fecha) => api(`/info-final-articulos?fecha=${encodeURIComponent(fecha || '')}`),
  /** Guardar UXB para un artículo en una fecha (registra en historial) */
  saveUxb: (body) => api('/info-final-articulos/uxb', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const users = {
  list: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api(`/users${q ? `?${q}` : ''}`);
  },
  create: (body) => api('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const roles = {
  list: () => api('/roles'),
  create: (body) => api('/roles', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id) => api(`/roles/${id}`, { method: 'DELETE' }),
};

/** Historial de actividad (solo quien tiene gestión de usuarios). Params: userId?, entity?, desde?, hasta?, limit? */
export const logs = {
  list: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api(`/logs${q ? `?${q}` : ''}`);
  },
};
