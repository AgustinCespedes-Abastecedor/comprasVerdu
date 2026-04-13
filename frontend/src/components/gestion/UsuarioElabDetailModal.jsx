import { useState, useEffect } from 'react';
import { Building2, Hash, IdCard, Layers, Phone, User, Mail, MapPin } from 'lucide-react';
import Modal from '../Modal';
import { users } from '../../api/client';

const ni = { size: 18, strokeWidth: 1.75, 'aria-hidden': true };

const ROWS = [
  { key: 'nombreCompleto', label: 'Nombre completo', icon: User },
  { key: 'usuario', label: 'Usuario', icon: Hash },
  { key: 'legajo', label: 'Legajo', icon: IdCard },
  { key: 'nivel', label: 'Nivel', icon: Layers },
  { key: 'sucursal', label: 'Sucursal', icon: Building2 },
  { key: 'sector', label: 'Sector', icon: MapPin },
  { key: 'telefono', label: 'Teléfono', icon: Phone },
  { key: 'interno', label: 'Interno', icon: Phone },
  { key: 'email', label: 'EMail', icon: Mail },
  { key: 'codigo', label: 'Código', icon: Hash },
];

/**
 * Modal con datos del usuario leídos desde ELABASTECEDOR (SQL Server).
 */
export default function UsuarioElabDetailModal({ open, user, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [retryToken, setRetryToken] = useState(0);

  const externId = user?.externUserId != null ? String(user.externUserId).trim() : '';

  useEffect(() => {
    if (!open || !externId) {
      setLoading(true);
      setError('');
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    users
      .elabDetalle(externId)
      .then((row) => {
        if (!cancelled) {
          setData(row);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar el detalle');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, externId, retryToken]);

  const title = user?.nombre?.trim() || 'Usuario — El Abastecedor';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Datos desde la base ELABASTECEDOR"
      size="large"
      boxClassName="usuario-elab-detail"
      overlayClassName="modal-overlay--top"
    >
      {loading ? (
        <div className="usuario-elab-detail__loading" role="status" aria-live="polite">
          <span className="usuario-elab-detail__spinner" aria-hidden />
          <span className="usuario-elab-detail__loading-msg">Cargando datos del usuario…</span>
        </div>
      ) : error ? (
        <div className="usuario-elab-detail__error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="usuario-elab-detail__retry"
            onClick={() => setRetryToken((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : data ? (
        <div className="usuario-elab-detail__body">
          <dl className="usuario-elab-detail__grid">
            {ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="usuario-elab-detail__item">
                <dt className="usuario-elab-detail__term">
                  <Icon {...ni} className="usuario-elab-detail__term-icon" />
                  {label}
                </dt>
                <dd className="usuario-elab-detail__value">{data[key] ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="usuario-elab-detail__footer">
            <button type="button" className="usuario-elab-detail__close" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <p className="usuario-elab-detail__empty">Sin datos.</p>
      )}
    </Modal>
  );
}
