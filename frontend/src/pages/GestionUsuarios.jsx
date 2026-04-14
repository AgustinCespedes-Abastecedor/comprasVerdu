import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { users, roles as rolesApi, auth as authApi } from '../api/client';
import { puedeGestionarRoles } from '../lib/roles';
import { PANTALLAS } from '../lib/permisos';
import { useAuth } from '../context/AuthContext';
import { usePullToRefresh } from '../context/PullToRefreshContext';
import AppHeader from '../components/AppHeader';
import BackNavIcon from '../components/icons/BackNavIcon';
import ThemeToggle from '../components/ThemeToggle';
import PasswordInput from '../components/PasswordInput';
import AppLoader from '../components/AppLoader';
import Modal from '../components/Modal';
import { formatForReport } from '../lib/errorReport';
import UsuarioListCard from '../components/gestion/UsuarioListCard';
import UsuarioTableRow from '../components/gestion/UsuarioTableRow';
import UsuarioElabDetailModal from '../components/gestion/UsuarioElabDetailModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useIsNativeApp } from '../hooks/useIsNativeApp';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import './GestionUsuarios.css';

/** Espera a que el usuario deje de escribir antes de consultar al servidor (ms). */
const BUSCAR_USUARIOS_DEBOUNCE_MS = 380;

export default function GestionUsuarios() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  /** Solo la primera carga de la lista: pantalla completa con AppLoader. */
  const [initialLoading, setInitialLoading] = useState(true);
  /** Refetch por búsqueda/filtro: indicador discreto, lista anterior visible. */
  const [listRefreshing, setListRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, BUSCAR_USUARIOS_DEBOUNCE_MS);
  const [roleFilter, setRoleFilter] = useState('');
  const initialUsersFetchDoneRef = useRef(false);
  const listFetchSeqRef = useRef(0);
  const [tab, setTab] = useState('usuarios'); // 'usuarios' | 'roles'
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  /** Confirmación in-app para eliminar rol (evita window.confirm). */
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState(null);
  const [deletingRole, setDeletingRole] = useState(false);
  /** Tras GET /auth/config: si es true, la lista mezcla ELABASTECEDOR + Postgres. */
  const [externalAuthLogin, setExternalAuthLogin] = useState(false);
  const [authConfigReady, setAuthConfigReady] = useState(false);

  const puedeRoles = puedeGestionarRoles(user);
  const escritorioLg = useMediaQuery('(min-width: 1024px)');
  const isNativeApp = useIsNativeApp();
  /** Tabla densa en navegador de escritorio; tarjetas en móvil y en APK. */
  const vistaTablaEscritorio = escritorioLg && !isNativeApp;
  /** Texto distinto al valor ya aplicado en servidor (esperando debounce). */
  const busquedaPendiente = search !== debouncedSearch;
  const deleteRoleDescriptionId = useId();

  useEffect(() => {
    authApi.getPublicConfig()
      .then((c) => {
        setExternalAuthLogin(Boolean(c?.externalAuthLogin));
        setAuthConfigReady(true);
      })
      .catch(() => {
        setExternalAuthLogin(false);
        setAuthConfigReady(true);
      });
  }, []);

  const buildUserListParams = useCallback(() => {
    const params = {};
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (roleFilter) params.roleId = roleFilter;
    return params;
  }, [debouncedSearch, roleFilter]);

  /** Petición al servidor para la lista (compartida por efecto y acciones manuales). */
  const fetchUserListFromServer = useCallback(
    () => users.list(buildUserListParams()),
    [buildUserListParams],
  );

  const loadUsers = useCallback(async () => {
    const seq = ++listFetchSeqRef.current;
    try {
      const data = await fetchUserListFromServer();
      if (seq !== listFetchSeqRef.current) return;
      setList(data);
      setError('');
      setErrorCode('');
    } catch (e) {
      if (seq !== listFetchSeqRef.current) return;
      setList([]);
      setError(e.message);
      setErrorCode(e?.code ?? '');
    } finally {
      if (seq === listFetchSeqRef.current) {
        setListRefreshing(false);
      }
    }
  }, [fetchUserListFromServer]);

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
    rolesApi.list().then(setRolesList).catch(() => setRolesList([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const seq = ++listFetchSeqRef.current;
    const isFirst = !initialUsersFetchDoneRef.current;
    if (isFirst) setInitialLoading(true);
    else setListRefreshing(true);
    setError('');
    setErrorCode('');

    (async () => {
      try {
        const data = await fetchUserListFromServer();
        if (cancelled || seq !== listFetchSeqRef.current) return;
        setList(data);
        setError('');
        setErrorCode('');
      } catch (e) {
        if (cancelled || seq !== listFetchSeqRef.current) return;
        setList([]);
        setError(e.message);
        setErrorCode(e?.code ?? '');
      }
      if (!cancelled && seq === listFetchSeqRef.current) {
        initialUsersFetchDoneRef.current = true;
        setInitialLoading(false);
        setListRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleFilter, fetchUserListFromServer]);

  const { registerRefresh } = usePullToRefresh();
  const doRefresh = useCallback(async () => {
    setListRefreshing(true);
    setError('');
    setErrorCode('');
    try {
      await loadUsers();
      if (puedeRoles) await loadRoles();
    } catch {
      /* loadUsers ya limpia estado y listRefreshing en finally */
    }
  }, [loadUsers, loadRoles, puedeRoles]);

  const openUsuarioModal = useCallback((u) => {
    setError('');
    setErrorCode('');
    const ext = u.externUserId != null && String(u.externUserId).trim() !== '';
    if (ext) {
      setModal({ type: 'elab-detail', user: u });
      return;
    }
    setModal({ type: 'edit', user: u });
  }, []);
  useEffect(() => {
    registerRefresh(doRefresh);
    return () => registerRefresh(null);
  }, [doRefresh, registerRefresh]);

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
    setSaving(true);
    setError('');
    setErrorCode('');
    try {
      const nombre = form.nombre.value.trim();
      const email = form.email?.value?.trim().toLowerCase();
      const roleId = form.roleId.value;
      const password = form.password.value;
      const body = { nombre, roleId };
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

  const handleDeleteRoleClick = (role) => {
    setError('');
    setErrorCode('');
    setRoleDeleteConfirm(role);
  };

  const handleDeleteRoleConfirm = async () => {
    const role = roleDeleteConfirm;
    if (!role) return;
    setDeletingRole(true);
    setError('');
    setErrorCode('');
    try {
      await rolesApi.delete(role.id);
      setRoleDeleteConfirm(null);
      await loadRoles();
      await loadUsers();
    } catch (err) {
      setError(err.message);
      setErrorCode(err?.code ?? '');
    } finally {
      setDeletingRole(false);
    }
  };

  return (
    <div className="gestion-usuarios-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="gestion-usuarios-back" title="Volver al panel" aria-label="Volver al panel">
              <BackNavIcon className="gestion-usuarios-back-icon" />
            </Link>
            <h1 className="gestion-usuarios-header-title">Usuarios y roles</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="gestion-usuarios-main" aria-label="Gestión de usuarios y roles">
        {puedeRoles && (
          <div className="gestion-usuarios-tabs" role="tablist" aria-label="Secciones">
            <button
              type="button"
              role="tab"
              id="gestion-tab-usuarios"
              aria-selected={tab === 'usuarios'}
              aria-controls="gestion-panel-usuarios"
              className={`gestion-usuarios-tab ${tab === 'usuarios' ? 'gestion-usuarios-tab--active' : ''}`}
              onClick={() => setTab('usuarios')}
            >
              Usuarios
            </button>
            <button
              type="button"
              role="tab"
              id="gestion-tab-roles"
              aria-selected={tab === 'roles'}
              aria-controls="gestion-panel-roles"
              className={`gestion-usuarios-tab ${tab === 'roles' ? 'gestion-usuarios-tab--active' : ''}`}
              onClick={() => setTab('roles')}
            >
              Roles
            </button>
          </div>
        )}

        {tab === 'usuarios' && (
          <section
            id="gestion-panel-usuarios"
            role="tabpanel"
            {...(puedeRoles
              ? { 'aria-labelledby': 'gestion-tab-usuarios' }
              : { 'aria-label': 'Usuarios' })}
            className="gestion-usuarios-tab-panel"
          >
            {authConfigReady && externalAuthLogin && (
              <section className="gestion-usuarios-info-strip" aria-label="Información sobre usuarios">
                <p className="gestion-usuarios-info-strip__lead">
                  Listado de Usuarios del Abastecedor
                </p>
              </section>
            )}
            <div className="gestion-usuarios-toolbar">
              <div className="gestion-usuarios-filters">
                <input
                  type="search"
                  placeholder={authConfigReady && externalAuthLogin ? 'Nombre, email o usuario…' : 'Buscar por nombre o email…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="gestion-usuarios-search"
                  aria-label="Buscar usuarios"
                  autoComplete="off"
                  spellCheck="false"
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
              </div>
              <div className="gestion-usuarios-toolbar-right">
                {(busquedaPendiente || listRefreshing) && !initialLoading && (
                  <p className="gestion-usuarios-search-status" role="status" aria-live="polite">
                    {listRefreshing ? (
                      <>
                        <Loader2 className="gestion-usuarios-search-status__icon" aria-hidden strokeWidth={2} />
                        <span>Actualizando resultados…</span>
                      </>
                    ) : (
                      <span className="gestion-usuarios-search-status__hint">Buscando…</span>
                    )}
                  </p>
                )}
                {!initialLoading && list.length > 0 && (
                  <p className="gestion-usuarios-count" aria-live="polite">
                    {list.length} {list.length === 1 ? 'usuario' : 'usuarios'}
                  </p>
                )}
                {authConfigReady && !externalAuthLogin && (
                  <button type="button" className="gestion-usuarios-btn-new" onClick={() => { setModal('create'); setError(''); setErrorCode(''); }}>
                    Nuevo usuario
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="gestion-usuarios-alert gestion-usuarios-alert-error" role="alert">
                <p className="gestion-usuarios-error-message">{error}</p>
                {errorCode && <p className="gestion-usuarios-error-code">Código para reportar: {errorCode}</p>}
                <button
                  type="button"
                  className="gestion-usuarios-error-copy"
                  onClick={() => {
                    const text = formatForReport(error, errorCode);
                    navigator.clipboard.writeText(text).then(() => {
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    }).catch(() => {});
                  }}
                  aria-label="Copiar mensaje para reportar el error"
                >
                  {copyFeedback ? 'Copiado' : 'Copiar para reportar'}
                </button>
              </div>
            )}

            {initialLoading ? (
              <AppLoader message="Cargando usuarios..." />
            ) : list.length === 0 ? (
              <div className="gestion-usuarios-table-wrap gestion-usuarios-table-wrap--list">
                <div className="gestion-usuarios-empty">
                  <p>No hay usuarios que coincidan con los filtros.</p>
                  <p className="gestion-usuarios-empty-hint">
                    {authConfigReady && externalAuthLogin
                      ? 'Probá otra búsqueda. Los usuarios nuevos se crean en El Abastecedor.'
                      : 'Probá cambiando la búsqueda o agregá un nuevo usuario.'}
                  </p>
                </div>
              </div>
            ) : vistaTablaEscritorio ? (
              <div
                className={`gestion-usuarios-table-wrap gestion-usuarios-table-wrap--dense${listRefreshing ? ' gestion-usuarios-table-wrap--refreshing' : ''}`}
                aria-busy={listRefreshing}
              >
                <table
                  className="gestion-usuarios-table gestion-usuarios-dense-table"
                  role="grid"
                  aria-label="Listado de usuarios"
                >
                  <thead>
                    <tr>
                      <th scope="col" className="gestion-usuarios-col-nombre">Nombre</th>
                      <th scope="col" className="gestion-usuarios-col-mail">Email / usuario</th>
                      <th scope="col" className="gestion-usuarios-col-rol">Rol</th>
                      <th scope="col" className="gestion-usuarios-col-app">En la app</th>
                      <th scope="col" className="gestion-usuarios-col-n">Compras</th>
                      <th scope="col" className="gestion-usuarios-col-fecha">Alta</th>
                      <th scope="col" className="gestion-usuarios-col-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((u) => (
                      <UsuarioTableRow
                        key={u.id ?? `ext-${u.externUserId ?? u.email}`}
                        u={u}
                        externalAuthLogin={externalAuthLogin}
                        authConfigReady={authConfigReady}
                        onEdit={openUsuarioModal}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className={`gestion-usuarios-table-wrap gestion-usuarios-table-wrap--list${listRefreshing ? ' gestion-usuarios-table-wrap--refreshing' : ''}`}
                aria-busy={listRefreshing}
              >
                <ul className="gestion-user-cards" role="list">
                  {list.map((u) => {
                    const rowKey = u.id ?? `ext-${u.externUserId ?? u.email}`;
                    return (
                      <li key={rowKey} className="gestion-user-cards__item">
                        <UsuarioListCard
                          u={u}
                          externalAuthLogin={externalAuthLogin}
                          authConfigReady={authConfigReady}
                          onEdit={openUsuarioModal}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === 'roles' && puedeRoles && (
          <section
            id="gestion-panel-roles"
            role="tabpanel"
            aria-labelledby="gestion-tab-roles"
            className="gestion-usuarios-tab-panel"
          >
            {authConfigReady && externalAuthLogin && (
              <section className="gestion-usuarios-info-strip" aria-label="Roles y nivel en El Abastecedor">
                <p className="gestion-usuarios-info-strip__lead">
                  Cada tarjeta indica qué Nivel corresponde y qué hace ese rol en la app.
                </p>
              </section>
            )}
            <div className="gestion-usuarios-toolbar">
              <p className="gestion-usuarios-toolbar-hint">
                {authConfigReady && externalAuthLogin
                  ? 'Los permisos de pantalla deberían coincidir con el rol que asigna el Nivel en El Abastecedor.'
                  : 'Cada rol define qué pantallas puede usar quien lo tenga asignado.'}
              </p>
              <button type="button" className="gestion-usuarios-btn-new" onClick={() => { setModal('role-create'); setError(''); setErrorCode(''); }}>
                Nuevo rol
              </button>
            </div>
            {error && (
              <div className="gestion-usuarios-alert gestion-usuarios-alert-error" role="alert">
                <p className="gestion-usuarios-error-message">{error}</p>
                {errorCode && <p className="gestion-usuarios-error-code">Código para reportar: {errorCode}</p>}
                <button
                  type="button"
                  className="gestion-usuarios-error-copy"
                  onClick={() => {
                    const text = formatForReport(error, errorCode);
                    navigator.clipboard.writeText(text).then(() => {
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    }).catch(() => {});
                  }}
                  aria-label="Copiar mensaje para reportar el error"
                >
                  {copyFeedback ? 'Copiado' : 'Copiar para reportar'}
                </button>
              </div>
            )}
            <div className="gestion-usuarios-table-wrap gestion-usuarios-table-wrap--flush">
              {rolesList.length === 0 ? (
                <div className="gestion-usuarios-empty">
                  <p>No hay roles. Creá uno con &quot;Nuevo rol&quot;.</p>
                </div>
              ) : (
                <ul className="gestion-role-cards" role="list">
                  {rolesList.map((r) => (
                    <li key={r.id} className="gestion-role-cards__item">
                      <article className="gestion-role-card" aria-labelledby={`gestion-role-${r.id}`}>
                        <div className="gestion-role-card__body">
                          <p id={`gestion-role-${r.id}`} className="gestion-role-card__title">{r.nombre}</p>
                          <p className="gestion-role-card__desc">{r.descripcion?.trim() ? r.descripcion : 'Sin descripción.'}</p>
                          <p className="gestion-role-card__meta">
                            <span className="gestion-role-card__badge">{r.usuariosCount ?? 0} {(r.usuariosCount ?? 0) === 1 ? 'usuario' : 'usuarios'}</span>
                          </p>
                        </div>
                        <div className="gestion-role-card__actions">
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
                            onClick={() => handleDeleteRoleClick(r)}
                            title="Eliminar rol"
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
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

        <UsuarioElabDetailModal
          open={modal?.type === 'elab-detail' && !!modal?.user}
          user={modal?.type === 'elab-detail' ? modal.user : null}
          onClose={() => setModal(null)}
        />

        {/* Modal Editar usuario (solo cuentas locales sin El Abastecedor) */}
        <Modal
          open={modal?.type === 'edit' && !!modal?.user}
          onClose={() => !saving && setModal(null)}
          title="Editar usuario"
          preventClose={saving}
          boxClassName="gestion-usuarios-modal gestion-usuarios-modal--edit"
        >
          {modal?.type === 'edit' && modal?.user && !modal.user.externUserId && (
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
                {authConfigReady && externalAuthLogin && (
                  <p className="gestion-usuarios-role-nivel-hint" role="note">
                    Si usás El Abastecedor: indicá Nivel ELAB y qué puede hacerse en la app.
                  </p>
                )}
                <section className="gestion-usuarios-modal-section">
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-create-nombre">Nombre del rol</label>
                    <input id="role-create-nombre" name="nombre" type="text" required placeholder="Ej. Supervisor" />
                  </div>
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-create-desc">Descripción <span className="gestion-usuarios-optional">(opcional)</span></label>
                    <textarea
                      id="role-create-desc"
                      name="descripcion"
                      rows={3}
                      className="gestion-usuarios-textarea-desc"
                      placeholder="Nivel ELAB y alcance en la app"
                    />
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
                {authConfigReady && externalAuthLogin && (
                  <p className="gestion-usuarios-role-nivel-hint" role="note">
                    En El Abastecedor el rol lo define el <strong>Nivel</strong> en SQL; esta descripción es solo referencia.
                  </p>
                )}
                <section className="gestion-usuarios-modal-section">
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-edit-nombre">Nombre del rol</label>
                    <input id="role-edit-nombre" name="nombre" type="text" required defaultValue={modal.role.nombre} />
                  </div>
                  <div className="gestion-usuarios-form-group">
                    <label htmlFor="role-edit-desc">Descripción <span className="gestion-usuarios-optional">(opcional)</span></label>
                    <textarea
                      id="role-edit-desc"
                      name="descripcion"
                      rows={3}
                      className="gestion-usuarios-textarea-desc"
                      defaultValue={modal.role.descripcion || ''}
                      placeholder="Nivel ELAB y alcance en la app"
                    />
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

        <Modal
          open={roleDeleteConfirm != null}
          onClose={() => !deletingRole && setRoleDeleteConfirm(null)}
          title="Eliminar rol"
          preventClose={deletingRole}
          size="medium"
          ariaDescribedBy={deleteRoleDescriptionId}
        >
          <div className="gestion-usuarios-delete-role">
            <div className="gestion-usuarios-delete-role__icon-wrap" aria-hidden>
              <AlertTriangle className="gestion-usuarios-delete-role__icon" strokeWidth={2} />
            </div>
            <div id={deleteRoleDescriptionId} className="gestion-usuarios-delete-role__copy">
              <p className="gestion-usuarios-delete-role__lead">Esta acción no se puede deshacer.</p>
              <p className="gestion-usuarios-delete-role__text">
                Se eliminará el rol <strong>{roleDeleteConfirm?.nombre}</strong>. Solo es posible si ningún usuario lo tiene asignado.
              </p>
            </div>
            <div className="gestion-usuarios-modal-actions gestion-usuarios-modal-actions--danger">
              <button
                type="button"
                className="gestion-usuarios-btn-secondary"
                onClick={() => !deletingRole && setRoleDeleteConfirm(null)}
                disabled={deletingRole}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="gestion-usuarios-btn-danger gestion-usuarios-btn-danger--solid"
                onClick={handleDeleteRoleConfirm}
                disabled={deletingRole}
              >
                {deletingRole ? 'Eliminando…' : 'Eliminar rol'}
              </button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
