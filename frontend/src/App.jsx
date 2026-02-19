import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ResponseProvider } from './context/ResponseContext';
import { puedeAcceder } from './lib/roles';
import AppLoader from './components/AppLoader';
import Login from './pages/Login';
import Home from './pages/Home';
import PlanillaCompra from './pages/PlanillaCompra';
import RecepcionListado from './pages/RecepcionListado';
import VerCompras from './pages/VerCompras';
import VerRecepciones from './pages/VerRecepciones';
import InfoFinalArticulos from './pages/InfoFinalArticulos';
import GestionUsuarios from './pages/GestionUsuarios';

/** En APK: botón Atrás de Android navega en el historial de la app */
function BackButtonHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle;
    CapApp.addListener('backButton', () => { navigate(-1); })
      .then((h) => { listenerHandle = h; });
    return () => { listenerHandle?.remove(); };
  }, [navigate]);
  return null;
}

/** Ruta privada: exige login y, si se indica, el permiso para esa pantalla (sin permiso → redirect a /). */
function PrivateRoute({ children, permiso }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader message="Cargando..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (permiso && !puedeAcceder(user, permiso)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute permiso="home">
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/comprar"
        element={
          <PrivateRoute permiso="comprar">
            <PlanillaCompra />
          </PrivateRoute>
        }
      />
      <Route
        path="/recepcion"
        element={
          <PrivateRoute permiso="recepcion">
            <RecepcionListado />
          </PrivateRoute>
        }
      />
      <Route
        path="/ver-compras"
        element={
          <PrivateRoute permiso="ver-compras">
            <VerCompras />
          </PrivateRoute>
        }
      />
      <Route
        path="/ver-recepciones"
        element={
          <PrivateRoute permiso="ver-recepciones">
            <VerRecepciones />
          </PrivateRoute>
        }
      />
      <Route
        path="/info-final-articulos"
        element={
          <PrivateRoute permiso="info-final-articulos">
            <InfoFinalArticulos />
          </PrivateRoute>
        }
      />
      <Route
        path="/gestion-usuarios"
        element={
          <PrivateRoute permiso="gestion-usuarios">
            <GestionUsuarios />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ResponseProvider>
          <BackButtonHandler />
          <AppRoutes />
        </ResponseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
