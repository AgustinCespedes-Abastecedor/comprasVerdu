import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './PasswordInput.css';

export default function PasswordInput({ id, className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input-wrap ${className}`.trim()}>
      <input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        className="password-input-field"
        autoComplete={props.autoComplete}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
        aria-label={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="password-toggle-icon" aria-hidden strokeWidth={2} />
        ) : (
          <Eye className="password-toggle-icon" aria-hidden strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
