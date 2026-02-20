# Manual de usuario — Compras Verdu

Este manual describe cómo usar la aplicación **Compras Verdu** para cargar compras a proveedores, registrar recepciones, definir precios de venta y consultar la información final de artículos. Está pensado para todos los usuarios (Comprador, Visor y Administrador).

---

## 1. Introducción

**Compras Verdu** es un sistema web para:

- **Cargar compras** a proveedores (planilla con productos, bultos y precios).
- **Registrar recepciones** (qué cantidades y UxB se recibieron por cada ítem).
- **Cargar precios de venta** por recepción (y ver el margen calculado).
- **Consultar** compras y recepciones, y comparar datos de recepción con el sistema Tecnolar en **Info Final de Artículos**.

Lo que veas en pantalla depende de tu **rol** y permisos. Por ejemplo, un usuario **Visor** solo puede consultar; un **Comprador** puede además cargar compras y recepciones. Un **Administrador** puede gestionar usuarios y roles.

---

## 2. Acceso a la aplicación

### 2.1 Iniciar sesión

1. Abrí la aplicación en el navegador (o en la app móvil si está configurada).
2. En la pantalla de **Iniciar sesión** ingresá:
   - **Email** (el que te dio el administrador).
   - **Contraseña**.
3. Hacé clic en **Entrar**.
4. Si los datos son correctos, entrás al **Panel de control (Home)**.

Si aparece un error, revisá email y contraseña. Si el problema continúa, contactá al administrador (podés reportar el **código de error** que se muestra).

### 2.2 Crear cuenta (registro)

Si tu organización permite el registro público:

1. En la pantalla de login, elegí **Crear cuenta**.
2. Completá: **Nombre**, **Email**, **Contraseña** (mínimo 6 caracteres) y **Rol** (por ejemplo Comprador o Visor).
3. Hacé clic en **Registrarme**.
4. Entrás al panel con el rol elegido.

El rol **Administrador** no suele estar disponible en el registro; se asigna desde Gestión de usuarios.

### 2.3 Cerrar sesión

En el **Panel de control**, en la esquina superior derecha hay un botón para **Cerrar sesión**. Al hacer clic, volvés a la pantalla de login.

### 2.4 Tema claro / oscuro

Podés cambiar entre tema claro y oscuro con el selector que aparece en el encabezado (junto al cierre de sesión). La preferencia se guarda en el dispositivo.

---

## 3. Panel de control (Home)

Después de iniciar sesión ves el **Panel de control**. Ahí tenés:

- Un saludo con tu nombre y tu **rol** (por ejemplo Comprador, Visor, Administrador).
- **Tarjetas de acceso** a las pantallas a las que tenés permiso:
  - **Nueva compra** — Cargar compra a proveedores desde la planilla.
  - **Recepción de compras** — Elegir compra por fecha y cargar cantidades recibidas.
  - **Ver compras** — Consultar y filtrar historial de compras.
  - **Ver recepciones** — Consultar historial de recepciones.
  - **Info Final de Artículos** — Artículos por fecha con datos de Tecnolar y costo ponderado.

Si tenés permiso de **Gestión de usuarios**, verás además:

- **Gestión de usuarios** — Dar de alta usuarios, editar datos y roles, y (si tenés permiso) gestionar roles.
- **Historial de actividad** — Ver el registro de acciones (auditoría).

En cada tarjeta hay un enlace (por ejemplo "Ir a comprar", "Ver listado") que lleva a esa pantalla. Solo se muestran las pantallas que tu rol tiene permitidas.

Para volver al panel desde cualquier pantalla, usá el botón **atrás** (flecha) o el logo/enlace al inicio según cómo esté armada la pantalla.

---

## 4. Nueva compra

Esta pantalla sirve para **cargar una compra** a un proveedor: fecha, proveedor y ítems con bultos y precios.

**Requisito:** tener permiso **Nueva compra** (por ejemplo rol Comprador).

### 4.1 Datos generales

- **Fecha:** por defecto es la fecha de hoy. Podés cambiarla; es la fecha que se asocia a la compra.
- **Proveedor:** elegí el proveedor de la lista. Si hay muchos, podés usar el buscador para filtrar por nombre.

### 4.2 Agregar productos a la planilla

- En el campo **Buscar artículo** escribí código o descripción del producto. La aplicación busca en el catálogo (según proveedor y fecha).
- Elegí el producto de los resultados para agregarlo como una **fila** en la planilla.
- Podés agregar tantas filas como ítems tenga la compra. Para quitar una fila, usá el botón de eliminar de esa fila.

### 4.3 Completar la planilla

Cada fila tiene columnas que pueden ser:

- **Solo lectura** (datos que vienen del sistema, por ejemplo stock, ventas).
- **Editables:** por ejemplo **Bultos**, **Costo por unidad** (o precio por bulto según diseño). Los totales y precios por kg se calculan solos.

Completá **Bultos** y el **costo/precio** que corresponda en cada ítem. Revisá que los totales se vean bien.

### 4.4 Guardar la compra

- Cuando la planilla esté completa, hacé clic en **Guardar compra** (o el botón equivalente).
- La aplicación asigna un **número de compra** (secuencial) y guarda la compra con todos los ítems. Podés ver el total del día actual en la misma pantalla.

Si aparece un error (por ejemplo datos incompletos), corregí lo indicado y volvé a guardar.

---

## 5. Recepción de compras

Aquí se **registra qué se recibió** de cada compra: cantidades por ítem y **UxB** (unidades por bulto).

**Requisito:** tener permiso **Recepción de compras**.

### 5.1 Listar compras pendientes de recepción

- Por defecto se listan las compras que **aún no tienen recepción** cargada.
- Podés filtrar por **Desde** y **Hasta** (fecha de la compra) para acotar el listado.

### 5.2 Cargar la recepción

1. Hacé clic en la compra que querés recibir. Se expande y se muestran los ítems (producto, bultos comprados, etc.).
2. Por cada ítem completá:
   - **Bultos recibidos** (cantidad que llegó).
   - **UxB** (unidades por bulto de ese ítem).
3. Revisá que los datos sean correctos y hacé clic en **Guardar recepción**.

La recepción queda asociada a esa compra. Más adelante podrás cargar el **precio de venta** de esa recepción desde **Ver recepciones**.

**Importante:** Registrar la recepción en Compras Verdu **no actualiza el inventario** en ningún otro sistema. La conciliación con stock se hace por otro canal.

---

## 6. Ver compras

Pantalla de **consulta** del historial de compras.

**Requisito:** tener permiso **Ver compras**.

### 6.1 Filtros

- **Desde** y **Hasta:** rango de fechas de las compras.
- **Proveedor:** opcional; si lo elegís, solo se listan compras de ese proveedor.

### 6.2 Listado y detalle

- Se muestra una lista de compras (número, fecha, proveedor, etc.). Hacé clic en una compra para **expandir** y ver el detalle por ítem: bultos comprados, bultos recibidos (si hay recepción), costo, UxB, precio de venta y margen si ya se cargó en Ver recepciones.

### 6.3 Exportar a Excel

Si la pantalla incluye opciones de exportación, podés generar planillas Excel (por ejemplo por compra o por artículo) para usar fuera de la app.

---

## 7. Ver recepciones

Aquí se **consultan las recepciones** ya cargadas y se pueden **definir los precios de venta** por ítem.

**Requisito:** tener permiso **Ver recepciones** (y para cargar precios, **Recepción de compras** según configuración).

### 7.1 Filtros y listado

- Filtrá por **Desde** y **Hasta** (fecha de la compra asociada).
- Se listan las recepciones en ese rango (número de recepción, fecha, proveedor, usuario que cargó, etc.).

### 7.2 Ver detalle

- Hacé clic en una recepción para **expandir** y ver el detalle por ítem: código, descripción, costo (calculado), precio de venta (si ya se cargó), margen %.

### 7.3 Agregar o modificar precio de venta

- Si la recepción aún no tiene precios de venta (o querés cambiarlos), usá el botón **Agregar Prec.Venta** (o similar) en esa recepción.
- Se abre un **modal** con una tabla: por cada ítem podés ingresar el **Precio de venta**. El sistema calcula el **Margen %** (MarkUP) con el costo de ese ítem.
- Completá los precios que necesites y hacé clic en **Guardar precios**. El margen se guarda junto con el precio.

**Importante:** Los precios de venta guardados aquí son **registro interno**. La carga de precios al sistema de ventas (Tecnolar, caja, etc.) es **manual o la realiza otro sistema**.

---

## 8. Info Final de Artículos

Esta pantalla muestra, **por fecha**, un resumen por **artículo** (código) con la información de la **última recepción** de ese artículo en ese día, y la compara con los datos del **Sistema Tecnolar**.

**Requisito:** tener permiso **Info Final de Artículos**.

### 8.1 Elegir fecha

- En **Fecha de la compra** elegí el día del que querés ver la info. Por defecto puede ser hoy.

### 8.2 Interpretar la pantalla

- Se lista **un ítem por código de artículo** (el que corresponde a la última recepción de ese artículo en esa fecha).
- Para cada ítem podés **expandir** y ver dos bloques:
  - **Sistema Tecnolar:** UxB, PrecioCosto, Margen, PrecioVenta que vienen del sistema externo.
  - **Datos recepción:** los datos que se cargaron en la recepción (Recepción Nº / Compra Nº), incluyendo UxB, costos, margen y precio de venta.

Si hay **diferencias** entre Tecnolar y lo recibido (por ejemplo UxB distinto), la interfaz puede resaltarlas para que las revises.

### 8.3 Guardar UxB

- En algunos ítems podés **editar el UxB** (cuando la recepción lo permite: por ejemplo si es nueva o si hubo una recepción posterior al último guardado).
- Ingresá el valor de UxB (número entero mayor que 0) y hacé clic en **Guardar**. Ese valor queda guardado para los detalles de recepción correspondientes y se registra en el historial de actividad.

Si el ítem ya tiene UxB guardado y no hay recepción nueva pendiente, el campo puede mostrarse como solo lectura (**Guardado**).

---

## 9. Gestión de usuarios (administración)

Permite **crear usuarios**, **editar** sus datos (nombre, email, contraseña, rol, estado activo/inactivo) y, si tenés permiso, **gestionar roles** (crear, editar y eliminar roles y sus pantallas permitidas).

**Requisito:** tener permiso **Gestión de usuarios**. La pestaña **Roles** solo la ve quien tiene además **Gestión de roles** (típicamente Administrador).

### 9.1 Pestaña Usuarios

- **Listado:** se muestran los usuarios con nombre, email, rol, estado (Activo/Inactivo) y fecha de alta.
- **Nuevo usuario:** botón que abre un modal para crear un usuario (nombre, email, contraseña, rol). Al guardar, el usuario ya puede iniciar sesión con ese email y contraseña.
- **Editar usuario:** desde el listado se puede abrir el formulario de edición para cambiar nombre, email, estado (Activo/Inactivo), rol y opcionalmente la contraseña.

Un usuario **Inactivo** no puede iniciar sesión.

### 9.2 Pestaña Roles

- **Listado de roles** con la cantidad de usuarios que tienen ese rol.
- **Nuevo rol:** nombre, descripción opcional y **checklist de pantallas permitidas**. Las pantallas que marques serán las que un usuario con ese rol pueda ver y usar.
- **Editar rol:** podés cambiar nombre, descripción y qué pantallas tiene permitidas ese rol.
- **Eliminar rol:** solo si no tiene usuarios asignados.

Las pantallas que se pueden marcar/desmarcar son: Panel de control (Home), Nueva compra, Ver compras, Recepción de compras, Ver recepciones, Info Final de Artículos, Gestión de usuarios, Gestión de roles.

---

## 10. Historial de actividad (Logs)

Muestra el **registro de acciones** realizadas en el sistema: quién hizo qué y cuándo (compras creadas, recepciones creadas o actualizadas, precios de venta, UXB en Info Final, usuarios y roles modificados, etc.).

**Requisito:** tener permiso **Gestión de usuarios**.

### 10.1 Filtros y paginación

- Por defecto se muestra el historial del **día actual**.
- Podés filtrar por **Usuario** (y ver todo el historial de ese usuario), por **Tipo** (entidad: compra, recepción, usuario, rol, etc.) y por **Desde** / **Hasta** (fechas).
- La lista está **paginada**. Podés cambiar la cantidad de registros por página y navegar entre páginas.

### 10.2 Ver detalle de una acción

- Hacé clic en **Ver** (o el botón de detalle) en la fila que te interese. Se abre un **modal** con:
  - Quién realizó la acción, cuándo, tipo de acción (crear, modificar, etc.) y entidad (compra, recepción, etc.).
  - **Información cargada:** los datos que se guardaron en esa acción (por ejemplo número de compra, fecha, proveedor, totales, ítems con bultos y precios, o precios de venta y márgenes por ítem, o UxB en Info Final).

Esto sirve para auditoría y para revisar qué valores se cargaron en cada operación.

---

## 11. Resumen rápido por rol

| Acción | Visor | Comprador | Administrador |
|--------|--------|-----------|----------------|
| Ver panel (Home) | Sí | Sí | Sí |
| Ver compras | Sí | Sí | Sí |
| Ver recepciones | Sí | Sí | Sí |
| Info Final de Artículos | Sí | Sí | Sí |
| Nueva compra | No | Sí | Sí |
| Recepción de compras | No | Sí | Sí |
| Cargar precios de venta (Ver recepciones) | No | Sí | Sí |
| Gestión de usuarios | No | No* | Sí |
| Gestión de roles | No | No | Sí |
| Historial de actividad | No | No* | Sí |

\* Salvo que el rol tenga explícitamente el permiso correspondiente.

---

## 12. Enlaces a documentación técnica

Para detalles sobre el alcance del sistema (inventario, precios y ventas) consultá la documentación del proyecto en el repositorio: Recepción e inventario, Precios y ventas, Roles y permisos.

---

*Manual de usuario — Compras Verdu. El Abastecedor.*
