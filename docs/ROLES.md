# Roles y permisos

Sistema de tres roles con permisos bien definidos.

## Roles

| Rol          | Descripción |
|-------------|-------------|
| **Administrador** | Acceso total: cargar compras, ver compras y gestionar usuarios. |
| **Comprador**     | Puede cargar compras y ver el historial. No puede gestionar usuarios. |
| **Visor**         | Solo lectura: puede ver el listado y detalle de compras. No puede cargar compras ni acceder a gestión de usuarios. |

## Matriz de acciones

| Acción | ADMIN | COMPRADOR | VISOR |
|--------|:-----:|:---------:|:-----:|
| Iniciar sesión | ✅ | ✅ | ✅ |
| Panel de control (Home) | ✅ | ✅ | ✅ |
| **Nueva compra** (`/comprar`) | ✅ | ✅ | ❌ |
| **Ver compras** (`/ver-compras`) | ✅ | ✅ | ✅ |
| **Gestión de usuarios** (`/gestion-usuarios`) | ✅ | ❌ | ❌ |
| API: GET proveedores, productos, compras | ✅ | ✅ | ✅ |
| API: POST compras (guardar compra) | ✅ | ✅ | ❌ (403) |
| API: GET/POST/PATCH `/api/users` | ✅ | ❌ (403) | ❌ (403) |

## Implementación

- **Frontend:** permisos centralizados en `frontend/src/lib/roles.js`. Las rutas (`App.jsx`) y la pantalla Home usan estas funciones para mostrar u ocultar acciones y para proteger rutas.
- **Backend:** middleware en `backend/src/middleware/auth.js`:
  - `soloComprador`: obligatorio para POST compras (COMPRADOR y ADMIN).
  - `soloAdmin`: obligatorio para todas las rutas de `/api/users`.
- **Registro:** solo se puede elegir rol **Comprador** o **Visor**. El rol **Administrador** se asigna desde Gestión de usuarios (por un admin existente).

## Cómo probar

1. **Visor:** crear usuario con rol Visor (o desde Gestión de usuarios). Entrar y comprobar que solo ve "Ver compras" en el panel y que no puede abrir `/comprar` (redirige al panel).
2. **Comprador:** puede entrar a Nueva compra y Ver compras; no ve el bloque "Configuración" ni el enlace a Gestión de usuarios.
3. **Administrador:** ve todas las acciones, incluido Gestión de usuarios.
