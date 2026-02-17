import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { compras, proveedores as apiProveedores } from '../api/client';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import './VerCompras.css';

function formatNum(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('es-AR');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR');
}

export default function VerCompras() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedoresList, setProveedoresList] = useState([]);

  useEffect(() => {
    apiProveedores.list().then(setProveedoresList).catch(() => setProveedoresList([]));
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroDesde) params.desde = filtroDesde;
      if (filtroHasta) params.hasta = filtroHasta;
      if (proveedorId) params.proveedorId = proveedorId;
      const data = await compras.list(params);
      setList(data);
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [filtroDesde, filtroHasta, proveedorId]);

  return (
    <div className="vercompras-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="vercompras-back" title="Volver al panel" aria-label="Volver al panel">
              <svg className="vercompras-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <h1 className="vercompras-header-title">Ver Compras</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />
      <div className="vercompras-filtros">
        <div className="vercompras-field">
          <label>Desde</label>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
          />
        </div>
        <div className="vercompras-field">
          <label>Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
          />
        </div>
        <div className="vercompras-field">
          <label>Proveedor</label>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
          >
            <option value="">Todos</option>
            {proveedoresList.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="layout-center" style={{ padding: '2rem' }}>Cargando compras...</div>
      ) : list.length === 0 ? (
        <div className="vercompras-empty">No hay compras con los filtros elegidos.</div>
      ) : (
        <div className="vercompras-list">
          {list.map((c) => (
            <article key={c.id} className="vercompras-card">
              <div className="vercompras-card-head">
                <span className="vercompras-card-fecha">{formatDate(c.fecha)}</span>
                <span className="vercompras-card-proveedor">{c.proveedor?.nombre}</span>
                <span className="vercompras-card-user">{c.user?.nombre}</span>
              </div>
              <div className="vercompras-card-totales">
                <span>{formatNum(c.totalBultos)} bultos</span>
                <span>$ {formatNum(c.totalMonto)}</span>
              </div>
              {c.detalles?.length > 0 && (
                <table className="vercompras-detalle">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Bultos</th>
                      <th>Precio/Bulto</th>
                      <th>Peso/Bulto</th>
                      <th>$/KG</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.detalles.map((d) => (
                      <tr key={d.id}>
                        <td>{d.producto?.codigo}</td>
                        <td>{d.producto?.descripcion}</td>
                        <td>{formatNum(d.bultos)}</td>
                        <td>{formatNum(d.precioPorBulto)}</td>
                        <td>{formatNum(d.pesoPorBulto)}</td>
                        <td>{formatNum(d.precioPorKg)}</td>
                        <td>{formatNum(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
