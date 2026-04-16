import { getProveedorCodigo, getProveedorNombre } from '../lib/format';
import './ProveedorLabel.css';

export default function ProveedorLabel({ proveedor, className }) {
  const nombre = getProveedorNombre(proveedor);
  const codigo = getProveedorCodigo(proveedor);

  if (!nombre && !codigo) return <span className={className}>—</span>;

  return (
    <span className={`proveedor-label${className ? ` ${className}` : ''}`}>
      {nombre && <span className="proveedor-label-nombre">{nombre}</span>}
      {codigo && (
        <span className="proveedor-label-codigo" aria-label={`Código de proveedor ${codigo}`}>
          {codigo}
        </span>
      )}
    </span>
  );
}

