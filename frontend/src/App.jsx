import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ResponseProvider } from './context/ResponseContext';
import { PullToRefreshProvider } from './context/PullToRefreshContext';
import PullToRefresh from './components/PullToRefresh';
import { puedeAcceder, puedeGestionarUsuarios } from './lib/roles';
import AppLoader from './components/AppLoader';
import Login from './pages/Login';
import Home from './pages/Home';
import PlanillaCompra from './pages/PlanillaCompra';
import RecepcionListado from './pages/RecepcionListado';
import VerCompras from './pages/VerCompras';
import VerRecepciones from './pages/VerRecepciones';
import InfoFinalArticulos from './pages/InfoFinalArticulos';
import GestionUsuarios from './pages/GestionUsuarios';
import Logs from './pages/Logs';
import ManualUsuario from './pages/ManualUsuario';
import TrazabilidadCompras from './pages/TrazabilidadCompras';
import './button-ui.css';

/** En APK: botón Atrás de Android respeta historial; si no hay más atrás, cierra la app */
function BackButtonHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
        return;
      }
      void CapApp.exitApp();
    })
      .then((h) => { listenerHandle = h; });
    return () => { listenerHandle?.remove(); };
  }, [navigate]);
  return null;
}

/** Ruta privada: exige login y, si se indica, el permiso para esa pantalla (sin permiso → redirect a /). Si permitirAdmin es true, los admins siempre pueden acceder. */
function PrivateRoute({ children, permiso, permisos, permitirAdmin }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader message="Cargando..." />;
  if (!user) return <Navigate to="/login" replace />;
  const adminOk = permitirAdmin && puedeGestionarUsuarios(user);
  if (Array.isArray(permisos) && permisos.length > 0) {
    const tieneAlguno = permisos.some((p) => puedeAcceder(user, p)) || adminOk;
    if (!tieneAlguno) return <Navigate to="/" replace />;
  } else if (permiso) {
    const tienePermiso = puedeAcceder(user, permiso) || adminOk;
    if (!tienePermiso) return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutesWithTransition() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-page-transition">
      <AppRoutes />
    </div>
  );
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
        path="/trazabilidad-compras"
        element={
          <PrivateRoute permisos={['ver-compras', 'trazabilidad-compras']}>
            <TrazabilidadCompras />
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
      <Route
        path="/logs"
        element={
          <PrivateRoute permiso="logs" permitirAdmin>
            <Logs />
          </PrivateRoute>
        }
      />
      <Route
        path="/manual-usuario"
        element={
          <PrivateRoute>
            <ManualUsuario />
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
          <PullToRefreshProvider>
            <BackButtonHandler />
            <PullToRefresh />
            <div className="app-shell" role="application" aria-label="Compras Verdu">
              <AppRoutesWithTransition />
            </div>
          </PullToRefreshProvider>
        </ResponseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
