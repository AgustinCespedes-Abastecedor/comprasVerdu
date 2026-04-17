import './ListPaginationBar.css';

/**
 * Barra de paginación accesible (patrón alineado con Historial de actividad).
 * @param {{
 *   total: number,
 *   page: number,
 *   pageSize: number,
 *   onPageChange: (page: number) => void,
 *   onPageSizeChange: (size: number) => void,
 *   disabled?: boolean,
 *   navLabel: string,
 *   pageSizeOptions?: number[],
 * }} props
 */
export default function ListPaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  navLabel,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const go = (p) => {
    const pNum = Math.max(1, Math.min(p, totalPages));
    onPageChange(pNum);
  };

  const navAria = `${navLabel}. Página ${safePage} de ${totalPages}. Total ${total.toLocaleString('es-AR')} registros.`;

  return (
    <nav className="list-pg" aria-label={navAria}>
      <div className="list-pg-controls">
        <label className="list-pg-size">
          <span className="list-pg-size-label">Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="list-pg-select"
            aria-label="Registros por página"
            disabled={disabled}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="list-pg-btn"
          onClick={() => go(1)}
          disabled={disabled || safePage <= 1}
          aria-label="Primera página"
        >
          ««
        </button>
        <button
          type="button"
          className="list-pg-btn"
          onClick={() => go(safePage - 1)}
          disabled={disabled || safePage <= 1}
          aria-label="Página anterior"
        >
          «
        </button>
        <span className="list-pg-page" aria-current="page">
          Página {safePage} de {totalPages}
        </span>
        <button
          type="button"
          className="list-pg-btn"
          onClick={() => go(safePage + 1)}
          disabled={disabled || safePage >= totalPages}
          aria-label="Página siguiente"
        >
          »
        </button>
        <button
          type="button"
          className="list-pg-btn"
          onClick={() => go(totalPages)}
          disabled={disabled || safePage >= totalPages}
          aria-label="Última página"
        >
          »»
        </button>
      </div>
    </nav>
  );
}
