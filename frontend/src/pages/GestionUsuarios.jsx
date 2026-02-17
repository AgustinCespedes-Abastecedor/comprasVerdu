import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { users } from '../api/client';
import { rolEtiqueta } from '../lib/roles';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import './GestionUsuarios.css';

const ROLES_FILTER = [
  { value: '', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'COMPRADOR', label: 'Comprador' },
  { value: 'VISOR', label: 'Visor' },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GestionUsuarios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (rolFilter) params.rol = rolFilter;
      const data = await users.list(params);
      setList(data);
    } catch (e) {
      setList([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, rolFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const rol = form.rol.value;
    if (!nombre || !email || !password) {
      setError('Nombre, email y contraseña son obligatorios');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await users.create({ nombre, email, password, rol: rol || 'COMPRADOR' });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const rol = form.rol.value;
    const password = form.password.value;
    setSaving(true);
    setError('');
    try {
      const body = { nombre, rol };
      if (password.length > 0) body.password = password;
      await users.update(id, body);
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gestion-usuarios-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="gestion-usuarios-back" title="Volver al panel" aria-label="Volver al panel">
              <svg className="gestion-usuarios-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <div className="gestion-usuarios-header-title-block">
              <h1 className="gestion-usuarios-title">Gestión de usuarios</h1>
              <p className="gestion-usuarios-subtitle">Crear, editar y asignar roles a los usuarios del sistema</p>
            </div>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="gestion-usuarios-main">
        <div className="gestion-usuarios-toolbar">
          <div className="gestion-usuarios-filters">
            <input
              type="search"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="gestion-usuarios-search"
              aria-label="Buscar usuarios"
            />
            <select
              value={rolFilter}
              onChange={(e) => setRolFilter(e.target.value)}
              className="gestion-usuarios-select"
              aria-label="Filtrar por rol"
            >
              {ROLES_FILTER.map((r) => (
                <option key={r.value || 'all'} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="gestion-usuarios-btn-new" onClick={() => { setModal('create'); setError(''); }}>
            Nuevo usuario
          </button>
        </div>

        {error && (
          <div className="gestion-usuarios-alert gestion-usuarios-alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="gestion-usuarios-table-wrap">
          {loading ? (
            <div className="gestion-usuarios-loading">
              <div className="gestion-usuarios-spinner" />
              <p>Cargando usuarios...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="gestion-usuarios-empty">
              <p>No hay usuarios que coincidan con los filtros.</p>
              <p className="gestion-usuarios-empty-hint">Probá cambiando la búsqueda o agregá un nuevo usuario.</p>
            </div>
          ) : (
            <table className="gestion-usuarios-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Fecha de alta</th>
                  <th>Compras</th>
                  <th className="gestion-usuarios-th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`gestion-usuarios-rol-badge gestion-usuarios-rol-${u.rol.toLowerCase()}`}>
                        {rolEtiqueta(u.rol)}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u._count?.compras ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="gestion-usuarios-btn-edit"
                        onClick={() => { setModal({ type: 'edit', user: u }); setError(''); }}
                        title="Editar usuario"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modal === 'create' && (
        <div className="gestion-usuarios-overlay" onClick={() => !saving && setModal(null)}>
          <div className="gestion-usuarios-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="gestion-usuarios-modal-title">Nuevo usuario</h2>
            <form onSubmit={handleCreate}>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="create-nombre">Nombre</label>
                <input id="create-nombre" name="nombre" type="text" required placeholder="Ej. Juan Pérez" autoComplete="name" />
              </div>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="create-email">Email</label>
                <input id="create-email" name="email" type="email" required placeholder="usuario@ejemplo.com" autoComplete="email" />
              </div>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="create-password">Contraseña</label>
                <input id="create-password" name="password" type="password" required placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} />
              </div>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="create-rol">Rol</label>
                <select id="create-rol" name="rol">
                  <option value="COMPRADOR">Comprador</option>
                  <option value="VISOR">Visor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="gestion-usuarios-modal-actions">
                <button type="button" className="gestion-usuarios-btn-secondary" onClick={() => !saving && setModal(null)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="gestion-usuarios-btn-primary" disabled={saving}>
                  {saving ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'edit' && modal?.user && (
        <div className="gestion-usuarios-overlay" onClick={() => !saving && setModal(null)}>
          <div className="gestion-usuarios-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="gestion-usuarios-modal-title">Editar usuario</h2>
            <form onSubmit={(e) => handleUpdate(e, modal.user.id)}>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="edit-nombre">Nombre</label>
                <input id="edit-nombre" name="nombre" type="text" required defaultValue={modal.user.nombre} placeholder="Nombre completo" />
              </div>
              <div className="gestion-usuarios-form-group">
                <label>Email</label>
                <p className="gestion-usuarios-form-readonly">{modal.user.email}</p>
              </div>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="edit-rol">Rol</label>
                <select id="edit-rol" name="rol" defaultValue={modal.user.rol}>
                  <option value="COMPRADOR">Comprador</option>
                  <option value="VISOR">Visor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="gestion-usuarios-form-group">
                <label htmlFor="edit-password">Nueva contraseña <span className="gestion-usuarios-optional">(opcional)</span></label>
                <input id="edit-password" name="password" type="password" placeholder="Dejar en blanco para no cambiar" autoComplete="new-password" minLength={6} />
              </div>
              <div className="gestion-usuarios-modal-actions">
                <button type="button" className="gestion-usuarios-btn-secondary" onClick={() => !saving && setModal(null)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="gestion-usuarios-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
