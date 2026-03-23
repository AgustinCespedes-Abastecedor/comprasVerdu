import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticSelection } from '../lib/haptics';
import './ThemeToggle.css';

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
        onClick={() => {
          void hapticSelection();
          setTheme('light');
        }}
        aria-pressed={!isDark}
        title="Tema claro"
      >
        <Sun className="theme-toggle-lucide" aria-hidden strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${isDark ? 'theme-toggle-btn-active' : ''}`}
        onClick={() => {
          void hapticSelection();
          setTheme('dark');
        }}
        aria-pressed={isDark}
        title="Tema oscuro"
      >
        <Moon className="theme-toggle-lucide" aria-hidden strokeWidth={1.75} />
      </button>
      <span
        className="theme-toggle-thumb"
        data-active={isDark ? 'dark' : 'light'}
        aria-hidden
      />
    </div>
  );
}
