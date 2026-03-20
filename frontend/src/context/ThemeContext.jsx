import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const THEME_KEY = 'compras_verdu_theme';
const THEME_COLOR_BY_MODE = {
  dark: '#0d1117',
  light: '#f6f8fa',
};
const SystemBars = Capacitor.isNativePlatform() ? registerPlugin('SystemBars') : null;

const ThemeContext = createContext(null);

function syncThemeColorMeta(theme) {
  const color = THEME_COLOR_BY_MODE[theme] || THEME_COLOR_BY_MODE.dark;
  const themeColorTags = document.querySelectorAll('meta[name="theme-color"]');
  themeColorTags.forEach((tag) => tag.setAttribute('content', color));
}

async function syncNativeSystemBars(theme) {
  if (!Capacitor.isNativePlatform() || !SystemBars?.setStyle) return;

  const style = theme === 'light' ? 'LIGHT' : 'DARK';

  try {
    await SystemBars.setStyle({ bar: 'StatusBar', style });
    await SystemBars.setStyle({ bar: 'NavigationBar', style });
  } catch {
    // Evita romper el render si alguna API no está disponible en un dispositivo puntual.
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeColorMeta(theme);
    syncNativeSystemBars(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {
      // Ignorar fallos de localStorage (privado, etc.)
    }
  }, [theme]);

  const setTheme = (value) => {
    setThemeState(value === 'light' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
