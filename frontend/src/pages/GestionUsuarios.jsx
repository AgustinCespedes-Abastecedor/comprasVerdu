import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { users, roles as rolesApi } from '../api/client';
import { rolEtiqueta, puedeGestionarRoles } from '../lib/roles';
import { PANTALLAS } from '../lib/permisos';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import PasswordInput from '../components/PasswordInput';
import AppLoader from '../components/AppLoader';
import Modal from '../components/Modal';
import { formatDateShort } from '../lib/format';
import './GestionUsuarios.css';

export default function GestionUsuarios() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activoFilter, setActivoFilter] = useState(''); // '' = todos, 'true' = activos, 'false' = inactivos
  const [tab, setTab] = useState('usuarios'); // 'usuarios' | 'roles'
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const puedeRoles = puedeGestionarRoles(user);

  const loadUsers = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (roleFilter) params.roleId = roleFilter;
      if (activoFilter) params.activo = activoFilter;
      const data = await users.list(params);
      setList(data);
    } catch (e) {
      setList([]);
      setError(e.message);
      setErrorCode(e?.code ?? '');
    }
  }, [search, roleFilter, activoFilter]);

  const loadRoles = useCallback(async () => {
    if (!puedeRoles) return;
    try {
      const data = await rolesApi.list();
      setRolesList(data);
    } catch (e) {
      setRolesList([]);
    }
  }, [puedeRoles]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setErrorCode('');
    Promise.all([
      loadUsers(),
      rolesApi.list().then(setRolesList).catch(() => setRolesList([])),
    ]).finally(() => setLoading(false));
  }, [loadUsers]);

  useEffect(() => {
    if (modal === null && !loading) loadUsers();
  }, [modal, loading, loadUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const roleId = form.roleId.value;
    if (!nombre || !email || !password || !roleId) {
      setError('Nombre, email, contraseña y rol son obligatorios');
      setErrorCode('');
      return;
    }
    setSaving(true);
    setError('');
    setErrorCode('');
    try {
      await users.create({ nombre, email, password, roleId });
      setModal(null);
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async (e, id) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const email = form.email?.value?.trim().toLowerCase();
    const roleId = form.roleId.value;
    const password = form.password.value;
    const activo = form.estado.value === 'true';
    setSaving(true);
    setError('');
    setErrorCode('');
    try {
      const body = { nombre, roleId, activo };
      if (email !== undefined) body.email = email;
      if (password.length > 0) body.password = password;
      await users.update(id, body);
      setModal(null);
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (u) => {
    setError('');
    setErrorCode('');
    try {
      await users.update(u.id, { activo: !u.activo });
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const descripcion = form.descripcion.value.trim() || null;
    const permisos = Array.from(form.querySelectorAll('input[name="permiso"]:checked')).map((el) => el.value);
    if (!nombre) {
      setError('El nombre del rol es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    setErrorCode('');
    try {
      await rolesApi.create({ nombre, descripcion, permisos });
      setModal(null);
      loadRoles();
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (e, id) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const descripcion = form.descripcion.value.trim() || null;
    const permisos = Array.from(form.querySelectorAll('input[name="permiso"]:checked')).map((el) => el.value);
    if (!nombre) {
      setError('El nombre del rol es obligatorio');
      setErrorCode('');
      return;
    }
    setSaving(true);
    setError('');
    setErrorCode('');
    try {
      await rolesApi.update(id, { nombre, descripcion, permisos });
      setModal(null);
      loadRoles();
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`¿Eliminar el rol "${role.nombre}"? No se puede si tiene usuarios asignados.`)) return;
    setError('');
    setErrorCode('');
    try {
      await rolesApi.delete(role.id);
      loadRoles();
      loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
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
            <h1 className="gestion-usuarios-header-title">Usuarios y roles</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="gestion-usuarios-main">
        {puedeRoles && (
          <div className="gestion-usuarios-tabs">
            <button
              type="button"
              className={`gestion-usuarios-tab ${tab === 'usuarios' ? 'gestion-usuarios-tab--active' : ''}`}
              onClick={() => setTab('usuarios')}
            >
              Usuarios
            </button>
            <button
              type="button"
              className={`gestion-usuarios-tab ${tab === 'roles' ? 'gestion-usuarios-tab--active' : ''}`}
              onClick={() => setTab('roles')}
            >
              Roles
            </button>
          </div>
        )}

        {tab === 'usuarios' && (
          <>
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
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="gestion-usuarios-select"
                  aria-label="Filtrar por rol"
                >
                  <option value="">Todos los roles</option>
                  {rolesList.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                <select
                  value={activoFilter}
                  onChange={(e) => setActivoFilter(e.target.value)}
                  className="gestion-usuarios-select"
                  aria-label="Filtrar por estado"
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
              <button type="button" className="gestion-usuarios-btn-new" onClick={() => { setModal('create'); setError(''); setErrorCode(''); }}>
                Nuevo usuario
              </button>
            </div>

            {error && (
              <div className="gestion-usuarios-alert gestion-usuarios-alert-error" role="alert">
                {error}
                {errorCode && <span className="gestion-usuarios-error-code"> Código para reportar: {errorCode}</span>}
              </div>
            )}

            {loading ? (
              <AppLoader message="Cargando usuarios..." />
            ) : (
              <div className="gestion-usuarios-table-wrap">
                {list.length === 0 ? (
                  <div className="gestion-usuarios-empty">
                    <p>No hay usuarios que coincidan con los filtros.</p>
                    <p className="gestion-usuarios-empty-hint">Probá cambiando la búsqueda o agregá un nuevo usuario.</p>
                  </div>
                ) : (
                  <table className="gestion-usuarios-table gestion-usuarios-table--users">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Fecha de alta</th>
                        <th>Compras</th>
                        <th className="gestion-usuarios-th-actions">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((u) => (
                        <tr key={u.id} className={u.activo === false ? 'gestion-usuarios-row-inactivo' : ''}>
                          <td>{u.nombre}</td>
                          <td>{u.email}</td>
                          <td>
                            <span className="gestion-usuarios-rol-badge">
                              {u.rol || rolEtiqueta(u)}
                            </span>
                          </td>
                          <td>
                            <span className={`gestion-usuarios-estado-badge ${u.activo !== false ? 'gestion-usuarios-estado-activo' : 'gestion-usuarios-estado-inactivo'}`}>
                              {u.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>{formatDateShort(u.createdAt)}</td>
                          <td>{u._count?.compras ?? 0}</td>
                          <td>
                            <div className="gestion-usuarios-cell-actions">
                              <button
                                type="button"
                                className="gestion-usuarios-btn-edit"
                                onClick={() => { setModal({ type: 'edit', user: u }); setError(''); setErrorCode(''); }}
                                title="Editar usuario"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={u.activo !== false ? 'gestion-usuarios-btn-suspender' : 'gestion-usuarios-btn-activar'}
                                onClick={() => handleToggleActivo(u)}
                                title={u.activo !== false ? 'Suspender usuario' : 'Activar usuario'}
                              >
                                {u.activo !== false ? 'Suspender' : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'roles' && puedeRoles && (
          <>
            <div className="gestion-usuarios-toolbar">
              <span className="gestion-usuarios-toolbar-label">Permisos por pantalla: marcá qué puede ver y acceder cada rol.</span>
              <button type="button" className="gestion-usuarios-btn-new" onClick={() => { setModal('role-create'); setError(''); setErrorCode(''); }}>
                Nuevo rol
              </button>
            </div>
            {error && (
              <div className="gestion-usuarios-alert gestion-usuarios-alert-error" role="alert">
                {error}
                {errorCode && <span className="gestion-usuarios-error-code"> Código para reportar: {errorCode}</span>}
              </div>
            )}
            <div className="gestion-usuarios-table-wrap">
              {rolesList.length === 0 ? (
                <div className="gestion-usuarios-empty">
                  <p>No hay roles. Creá uno desde &quot;Nuevo rol&quot;.</p>
                </div>
              ) : (
                <table className="gestion-usuarios-table gestion-usuarios-table--roles">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th>Usuarios</th>
                      <th className="gestion-usuarios-th-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesList.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.nombre}</strong></td>
                        <td>{r.descripcion || '—'}</td>
                        <td>{r.usuariosCount ?? 0}</td>
                        <td>
                          <div className="gestion-usuarios-cell-actions">
                            <button
                              type="button"
                              className="gestion-usuarios-btn-edit"
                              onClick={() => { setModal({ type: 'role-edit', role: r }); setError(''); setErrorCode(''); }}
                              title="Editar rol"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="gestion-usuarios-btn-danger"
                              onClick={() => handleDeleteRole(r)}
                              title="Eliminar rol"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Modal Nuevo usuario */}
        <Modal open={modal === 'create'} onClose={() => !saving && setModal(null)} title="Nuevo usuario" preventClose={saving}>
          <form onSubmit={handleCreateUser}>
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
                  <PasswordInput id="create-password" name="password" required placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} />
                </div>
                <div className="gestion-usuarios-form-group">
                  <label htmlFor="create-roleId">Rol</label>
                  <select id="create-roleId" name="roleId" required>
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="gestion-usuarios-modal-actions">
                  <button type="button" className="gestion-usuarios-btn-secondary" onClick={() => !saving && setModal(null)} disabled={saving}>Cancelar</button>
                  <button type="submit" className="gestion-usuarios-btn-primary" disabled={saving}>
                    {saving ? 'Creando...' : 'Crear usuario'}
                  </button>
                </div>
              </form>
        </Modal>

        {/* Modal Editar usuario */}
        <Modal open={modal?.type === 'edit' && !!modal?.user} onClose={() => !saving && setModal(null)} title="Editar usuario" preventClose={saving} boxClassName="gestion-usuarios-modal gestion-usuarios-modal--edit">
          {modal?.type === 'edit' && modal?.user && (
              <form className="gestion-usuarios-modal-edit-form" onSubmit={(e) => handleUpdateUser(e, modal.user.id)}>
                <div className="gestion-usuarios-modal-edit-field">
                  <label htmlFor="edit-nombre">Nombre</label>
                  <input id="edit-nombre" name="nombre" type="text" required defaultValue={modal.user.nombre} placeholder="Nombre completo" />
                </div>
                <div className="gestion-usuarios-modal-edit-field">
                  <label htmlFor="edit-email">Email</label>
                  <input id="edit-email" name="email" type="email" required defaultValue={modal.user.email} placeholder="usuario@ejemplo.com" autoComplete="email" />
                </div>
                <div className="gestion-usuarios-modal-edit-field">
                  <label htmlFor="edit-estado">Estado</label>
                  <select id="edit-estado" name="estado" defaultValue={modal.user.activo !== false ? 'true' : 'false'}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div className="gestion-usuarios-modal-edit-field">
                  <label htmlFor="edit-roleId">Rol</label>
                  <select id="edit-roleId" name="roleId" defaultValue={modal.user.roleId} required>
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="gestion-usuarios-modal-edit-field">
                  <label htmlFor="edit-password">Nueva contraseña <span className="gestion-usuarios-modal-edit-optional">opcional</span></label>
                  <PasswordInput id="edit-password" name="password" placeholder="Dejar en blanco para no cambiar" autoComplete="new-password" minLength={6} />
                </div>
                <div className="gestion-usuarios-modal-edit-actions">
                  <button type="button" className="gestion-usuarios-modal-edit-btn-cancel" onClick={() => !saving && setModal(null)} disabled={saving}>Cancelar</button>
                  <button type="submit" className="gestion-usuarios-modal-edit-btn-save" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
          )}
        </Modal>

        {/* Modal Nuevo rol */}
        <Modal open={modal === 'role-create'} onClose={() => !saving && setModal(null)} title="Nuevo rol" size="wide" preventClose={saving} boxClassName="gestion-usuarios-modal gestion-usuarios-modal--role" subtitle="Definí el nombre y qué pantallas podrá ver y usar este rol.">
          <form onSubmit={handleCreateRole} className="gestion-usuarios-role-form">
                <section className="gestion-usuarios-modal-section">
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-create-nombre">Nombre del rol</label>
                    <input id="role-create-nombre" name="nombre" type="text" required placeholder="Ej. Supervisor" />
                  </div>
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-create-desc">Descripción <span className="gestion-usuarios-optional">(opcional)</span></label>
                    <input id="role-create-desc" name="descripcion" type="text" placeholder="Breve descripción del rol" />
                  </div>
                </section>
                <section className="gestion-usuarios-modal-section gestion-usuarios-modal-section--permisos">
                  <div className="gestion-usuarios-checklist-header">
                    <span className="gestion-usuarios-checklist-title">Pantallas permitidas</span>
                    <span className="gestion-usuarios-checklist-actions">
                      <button type="button" className="gestion-usuarios-checklist-link" onClick={(e) => e.target.closest('form')?.querySelectorAll('input[name="permiso"]').forEach((cb) => { cb.checked = true; })}>Seleccionar todo</button>
                      <span className="gestion-usuarios-checklist-sep">·</span>
                      <button type="button" className="gestion-usuarios-checklist-link" onClick={(e) => e.target.closest('form')?.querySelectorAll('input[name="permiso"]').forEach((cb) => { cb.checked = false; })}>Desmarcar todo</button>
                    </span>
                  </div>
                  <p className="gestion-usuarios-checklist-hint">El rol solo podrá ver y acceder a las pantallas que marques.</p>
                  <ul className="gestion-usuarios-checklist">
                    {PANTALLAS.map((p) => (
                      <li key={p.id}>
                        <label className="gestion-usuarios-checklist-item">
                          <input type="checkbox" name="permiso" value={p.id} />
                          <span>{p.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
                <div className="gestion-usuarios-modal-actions">
                  <button type="button" className="gestion-usuarios-btn-secondary" onClick={() => !saving && setModal(null)} disabled={saving}>Cancelar</button>
                  <button type="submit" className="gestion-usuarios-btn-primary" disabled={saving}>
                    {saving ? 'Creando...' : 'Crear rol'}
                  </button>
                </div>
              </form>
        </Modal>

        {/* Modal Editar rol */}
        <Modal open={modal?.type === 'role-edit' && !!modal?.role} onClose={() => !saving && setModal(null)} title="Editar rol" size="wide" preventClose={saving} boxClassName="gestion-usuarios-modal gestion-usuarios-modal--role" subtitle="Modificá el nombre y los permisos de pantalla de este rol.">
          {modal?.type === 'role-edit' && modal?.role && (
              <form onSubmit={(e) => handleUpdateRole(e, modal.role.id)} className="gestion-usuarios-role-form">
                <section className="gestion-usuarios-modal-section">
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-edit-nombre">Nombre del rol</label>
                    <input id="role-edit-nombre" name="nombre" type="text" required defaultValue={modal.role.nombre} />
                  </div>
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-edit-desc">Descripción <span className="gestion-usuarios-optional">(opcional)</span></label>
                    <input id="role-edit-desc" name="descripcion" type="text" defaultValue={modal.role.descripcion || ''} placeholder="Breve descripción" />
                  </div>
                </section>
                <section className="gestion-usuarios-modal-section gestion-usuarios-modal-section--permisos">
                  <div className="gestion-usuarios-checklist-header">
                    <span className="gestion-usuarios-checklist-title">Pantallas permitidas</span>
                    <span className="gestion-usuarios-checklist-actions">
                      <button type="button" className="gestion-usuarios-checklist-link" onClick={(e) => e.target.closest('form')?.querySelectorAll('input[name="permiso"]').forEach((cb) => { cb.checked = true; })}>Seleccionar todo</button>
                      <span className="gestion-usuarios-checklist-sep">·</span>
                      <button type="button" className="gestion-usuarios-checklist-link" onClick={(e) => e.target.closest('form')?.querySelectorAll('input[name="permiso"]').forEach((cb) => { cb.checked = false; })}>Desmarcar todo</button>
                    </span>
                  </div>
                  <p className="gestion-usuarios-checklist-hint">El rol solo podrá ver y acceder a las pantallas que marques.</p>
                  <ul className="gestion-usuarios-checklist">
                    {PANTALLAS.map((p) => (
                      <li key={p.id}>
                        <label className="gestion-usuarios-checklist-item">
                          <input
                            type="checkbox"
                            name="permiso"
                            value={p.id}
                            defaultChecked={Array.isArray(modal.role.permisos) && modal.role.permisos.includes(p.id)}
                          />
                          <span>{p.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
                <div className="gestion-usuarios-modal-actions">
                  <button type="button" className="gestion-usuarios-btn-secondary" onClick={() => !saving && setModal(null)} disabled={saving}>Cancelar</button>
                  <button type="submit" className="gestion-usuarios-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
          )}
        </Modal>
      </main>
    </div>
  );
}
