# Roles y permisos

Sistema de roles configurables: cada rol tiene un **checklist de pantallas** que define qué puede ver y a qué puede acceder. Si un rol no tiene permitida una pantalla, el usuario no la ve en el menú y **no puede ingresar ni por URL** (redirección al panel).

## ABM de roles

En **Gestión de usuarios** (solo quien tiene permiso `gestion-usuarios`), si además tenés permiso **`gestion-roles`** (típicamente Administrador) verás la pestaña **Roles**:

- **Listar roles** con cantidad de usuarios asignados.
- **Nuevo rol**: nombre, descripción opcional y **checklist de pantallas permitidas**.
- **Editar rol**: cambiar nombre, descripción y permisos (pantallas).
- **Eliminar rol**: solo si no tiene usuarios asignados.

Las pantallas que podés marcar/desmarcar por rol son:

- Panel de control (Home)
- Nueva compra
- Ver compras
- Recepción de compras
- Ver recepciones
- Info Final de Artículos
- Gestión de usuarios
- Gestión de roles (ABM roles)

## Roles por defecto (tras migración)

| Rol             | Descripción | Pantallas permitidas |
|-----------------|-------------|----------------------|
| **Administrador** | Acceso total | Todas (home, comprar, ver-compras, recepción, ver-recepciones, info-final-articulos, gestion-usuarios, gestion-roles). |
| **Comprador**   | Cargar compras y ver historial | home, comprar, ver-compras, recepcion, ver-recepciones, info-final-articulos. |
| **Visor**       | Solo lectura | home, ver-compras, ver-recepciones, info-final-articulos. |

## Control de acceso

- **Frontend:** `App.jsx` protege cada ruta con un permiso (`PrivateRoute` con `permiso="comprar"`, etc.). Si el usuario no tiene ese permiso en `user.role.permisos`, se redirige a `/`. El **Home** solo muestra enlaces a pantallas para las que el usuario tiene permiso.
- **Backend:** `authMiddleware` carga `req.permisos` desde el rol del usuario. Las rutas usan `requierePermiso('comprar')`, `soloGestionUsuarios`, `soloGestionRoles`, etc. Sin permiso → 403.

## Implementación

- **Frontend:** `frontend/src/lib/permisos.js` define `PANTALLAS` y `puedeAcceder(user, codigo)`. `frontend/src/lib/roles.js` usa `user.role.permisos` para `puedeComprar`, `puedeGestionarUsuarios`, `puedeGestionarRoles`.
- **Backend:** modelo `Role` (nombre, descripcion, permisos JSON). `User.roleId` → `Role`. Rutas `GET/POST/PATCH/DELETE /api/roles` (crear/editar/eliminar solo con permiso `gestion-roles`; listar con `gestion-usuarios` o `gestion-roles`).
- **Registro público:** solo se puede elegir Comprador o Visor; Administrador se asigna desde Gestión de usuarios.

## Cómo probar

1. **Visor:** solo ve en el panel las pantallas permitidas (Ver compras, Ver recepciones, Info final). Si intenta abrir `/comprar` → redirige a `/`.
2. **Comprador:** ve Nueva compra, recepción, ver compras, etc.; no ve Gestión de usuarios si no tiene ese permiso.
3. **Administrador:** ve todo y puede entrar a Gestión de usuarios, pestaña Roles, y configurar permisos por pantalla para cada rol.
