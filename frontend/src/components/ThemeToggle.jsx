import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

function IconSun() {
  return (
    <svg className="theme-toggle-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.5M10 16.5V18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M2 10h1.5M16.5 10H18M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06M15.78 15.78l-1.06-1.06M5.28 5.28L4.22 4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="theme-toggle-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 10.5A7 7 0 1 1 9.5 3a5.5 5.5 0 0 0 7.5 7.5Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label="Tema de interfaz"
    >
      <button
        type="button"
        className={`theme-toggle-btn ${!isDark ? 'theme-toggle-btn-active' : ''}`}
        onClick={() => setTheme('light')}
        aria-pressed={!isDark}
        title="Tema claro"
      >
        <IconSun />
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${isDark ? 'theme-toggle-btn-active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-pressed={isDark}
        title="Tema oscuro"
      >
        <IconMoon />
      </button>
      <span className="theme-toggle-thumb" data-active={isDark ? 'dark' : 'light'} aria-hidden />
    </div>
  );
}
