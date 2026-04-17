import { useState, useEffect, useCallback, useMemo } from 'react';
import { users } from '../../api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { normalizeUsersListPayload, usersWithAppId } from '../../lib/usersApiResponse';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function optionLabel(u) {
  const nombre = (u.nombre != null && String(u.nombre).trim()) ? String(u.nombre).trim() : '—';
  const email = (u.email != null && String(u.email).trim()) ? String(u.email).trim() : '';
  return email ? `${nombre} (${email})` : nombre;
}

function mergeById(existing, incoming) {
  const seen = new Set(existing.map((u) => u.id).filter(Boolean));
  const out = [...existing];
  for (const u of incoming) {
    if (!u?.id || seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
  }
  return out;
}

/**
 * Filtro de usuario para Historial: búsqueda con debounce, listado paginado desde API y resolución del seleccionado.
 * @param {{
 *   value: string,
 *   onChange: (userId: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function LogsUserFilter({ value, onChange, disabled = false }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [options, setOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [remotePage, setRemotePage] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [pinnedUser, setPinnedUser] = useState(null);

  const fetchPage = useCallback(async (pageNum, qRaw) => {
    const params = {
      page: String(pageNum),
      pageSize: String(PAGE_SIZE),
    };
    const trimmed = typeof qRaw === 'string' ? qRaw.trim() : '';
    if (trimmed) params.q = trimmed;
    const raw = await users.list(params);
    const { items, total: t } = normalizeUsersListPayload(raw);
    const usable = usersWithAppId(items);
    return { items: usable, total: t };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setListError('');
      setRemotePage(1);
      try {
        const { items, total: t } = await fetchPage(1, debouncedSearch);
        if (cancelled) return;
        setOptions(items);
        setTotal(t);
      } catch {
        if (cancelled) return;
        setOptions([]);
        setTotal(0);
        setListError('No se pudo cargar el listado de usuarios.');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, fetchPage]);

  useEffect(() => {
    if (!value) {
      setPinnedUser(null);
      return;
    }
    let cancelled = false;
    const inOptions = options.some((u) => u.id === value);
    if (inOptions) {
      setPinnedUser(null);
      return;
    }
    (async () => {
      try {
        const u = await users.getSummary(value);
        if (!cancelled && u?.id) setPinnedUser(u);
        else if (!cancelled) setPinnedUser(null);
      } catch {
        if (!cancelled) setPinnedUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, options]);

  const selectOptions = useMemo(() => {
    const base = [...options];
    if (pinnedUser && pinnedUser.id === value && !base.some((u) => u.id === pinnedUser.id)) {
      return [pinnedUser, ...base];
    }
    return base;
  }, [options, pinnedUser, value]);

  const canLoadMore = options.length < total && !loadingList;

  const handleLoadMore = async () => {
    if (!canLoadMore || loadingMore) return;
    setLoadingMore(true);
    setListError('');
    try {
      const nextPage = remotePage + 1;
      const { items } = await fetchPage(nextPage, debouncedSearch);
      setOptions((prev) => mergeById(prev, items));
      setRemotePage(nextPage);
    } catch {
      setListError('No se pudieron cargar más usuarios.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="logs-user-filter" role="search" aria-label="Filtrar historial por usuario">
      <div className="logs-user-filter-row">
        <label className="logs-user-filter-label" htmlFor="logs-user-filter-q">
          Buscar usuario
        </label>
        <input
          id="logs-user-filter-q"
          type="search"
          className="logs-user-filter-search logs-select"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nombre o email…"
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
          aria-describedby="logs-user-filter-hint"
        />
      </div>
      <p id="logs-user-filter-hint" className="logs-user-filter-hint">
        {loadingList
          ? 'Cargando coincidencias…'
          : `${options.length.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} usuarios con cuenta en la app (podés cargar más o buscar).`}
      </p>
      {listError ? (
        <p className="logs-user-filter-error" role="alert">
          {listError}
        </p>
      ) : null}
      <div className="logs-user-filter-row logs-user-filter-row--select">
        <label className="logs-user-filter-label" htmlFor="logs-user-filter-select">
          Usuario del historial
        </label>
        <select
          id="logs-user-filter-select"
          className="logs-select logs-user-filter-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loadingList}
          aria-label="Elegir usuario para filtrar el historial"
        >
          <option value="">Todos los usuarios</option>
          {selectOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {optionLabel(u)}
            </option>
          ))}
        </select>
        {canLoadMore ? (
          <button
            type="button"
            className="logs-user-filter-more"
            onClick={handleLoadMore}
            disabled={disabled || loadingMore}
            aria-busy={loadingMore}
            aria-label="Cargar más usuarios en la lista"
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
