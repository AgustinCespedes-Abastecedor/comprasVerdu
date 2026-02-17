import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ResponseProvider } from './context/ResponseContext';
import Login from './pages/Login';
import Home from './pages/Home';
import PlanillaCompra from './pages/PlanillaCompra';
import VerCompras from './pages/VerCompras';
import GestionUsuarios from './pages/GestionUsuarios';

function PrivateRoute({ children, compradorOnly, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="layout-center">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (compradorOnly && user.rol !== 'COMPRADOR' && user.rol !== 'ADMIN') return <Navigate to="/" replace />;
  if (adminOnly && user.rol !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/comprar"
        element={
          <PrivateRoute compradorOnly>
            <PlanillaCompra />
          </PrivateRoute>
        }
      />
      <Route
        path="/ver-compras"
        element={
          <PrivateRoute>
            <VerCompras />
          </PrivateRoute>
        }
      />
      <Route
        path="/gestion-usuarios"
        element={
          <PrivateRoute adminOnly>
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
          <AppRoutes />
        </ResponseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
