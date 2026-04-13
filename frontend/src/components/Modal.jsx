import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Modal reutilizable: overlay + caja con título, cierre (Escape + click fuera + botón) y cuerpo scrolleable.
 * @param {boolean} open - Si el modal está visible
 * @param {() => void} onClose - Al cerrar (no se llama si preventClose es true)
 * @param {string} title - Título del modal (también usado para aria-labelledby si no se pasa id)
 * @param {string} [titleId] - Id del título para accesibilidad (por defecto se genera uno)
 * @param {React.ReactNode} [subtitle] - Texto o nodo debajo del título
 * @param {React.ReactNode} [headerExtra] - Nodo extra en el header (ej. badges)
 * @param {'medium'|'wide'|'large'} [size='medium'] - Ancho/alto del modal
 * @param {boolean} [preventClose=false] - Si true, no se cierra con Escape ni click fuera (ej. mientras guarda)
 * @param {string} [boxClassName] - Clases adicionales para la caja del modal (ej. variantes por pantalla)
 * @param {string} [overlayClassName] - Clases extra en el overlay (ej. modal-overlay--top)
 * @param {string} [ariaDescribedBy] - id del nodo que describe el diálogo (accesibilidad)
 * @param {React.ReactNode} children - Contenido del cuerpo (scroll interno)
 */
export default function Modal({
  open,
  onClose,
  title,
  titleId,
  subtitle,
  headerExtra,
  size = 'medium',
  preventClose = false,
  boxClassName,
  overlayClassName,
  ariaDescribedBy,
  children,
}) {
  const autoTitleId = useId();
  const id = titleId || autoTitleId;

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !preventClose) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, preventClose, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (!preventClose) onClose();
  };

  return (
    <div
      className={`modal-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      {...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {})}
    >
      <div
        className={`modal-box modal-box--${size}${boxClassName ? ` ${boxClassName}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-header-top">
            <h2 id={id} className="modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => !preventClose && onClose()}
              disabled={preventClose}
              aria-label="Cerrar"
            >
              <X className="modal-close-icon" aria-hidden strokeWidth={2} />
            </button>
          </div>
          {subtitle != null && subtitle !== '' && (
            <p className="modal-subtitle">{subtitle}</p>
          )}
          {headerExtra != null && <div className="modal-header-extra">{headerExtra}</div>}
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
