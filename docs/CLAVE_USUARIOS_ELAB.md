# Cifrado de la columna `Clave` (ELABASTECEDOR)

Este documento describe cómo se almacena la contraseña de usuario en la tabla de usuarios del sistema **ELABASTECEDOR** (SQL Server), tal como lo interpreta **Compras Verdu** y como quedó documentado en el código.

## Contexto

- **Tabla:** configurable (`EXTERNAL_USUARIOS_TABLE`, por defecto `Usuarios`).
- **Columna:** configurable (`EXTERNAL_USUARIOS_COL_PASSWORD`, por defecto `Clave`).
- **Tipo observado:** `NVARCHAR` (longitud máxima típica 20 caracteres), no es un hash estándar como MD5 ni el formato binario de `PWDENCRYPT` / `PWDCOMPARE` del motor SQL.

El valor guardado **no es la contraseña en texto plano**: es el resultado de un **algoritmo legado aplicado carácter a carácter** (desplazamiento de códigos ASCII en bloques).

## Algoritmo legado (cifrado por desplazamiento)

Se recorre la contraseña en orden de izquierda a derecha y se construye la cadena almacenada así:

### 1. Bloques de letras `[A-Za-z]`

Dentro de cada **bloque contiguo** de solo letras:

- La **primera letra** del bloque se transforma con: **código ASCII + 15**.
- Las **demás letras** del mismo bloque: **código ASCII − 17**.

Cada vez que el carácter siguiente **no es letra** (por ejemplo un dígito o un símbolo), el bloque de letras termina. Si más adelante vuelven a aparecer letras, se abre un **nuevo** bloque: otra vez la primera letra de ese tramo usa **+15** y las siguientes **−17**.

### 2. Dígitos `[0-9]`

Cada dígito se transforma con: **código ASCII + 15** (sin el patrón “primera / resto” de las letras).

### 3. Otros caracteres

Cualquier carácter que no sea letra ni dígito (espacios, símbolos, etc.) se **copia sin cambio** en la misma posición relativa (según la implementación en `elabLegacyPassword.js`).

## Ejemplo verificado

| Contraseña en claro | Valor almacenado en `Clave` |
|---------------------|-----------------------------|
| `Sinergia2025`      | `bX]TaVXPA?AD`              |

- `Sinergia` es un bloque de letras: `S` → +15, `i,n,e,r,g,i,a` → −17 cada una.
- `2025` son cuatro dígitos: cada uno +15.

No es reversible de forma “criptográfica” fuerte: es un **ofuscado** pensado para no guardar el texto plano en texto plano, típico de sistemas ERP antiguos.

## Qué **no** es este esquema

- No es **MD5** / **SHA** ni hex de hash (longitud y formato no coinciden).
- No es el hash binario estándar de **SQL Server** para `PWDCOMPARE` sobre `PWDENCRYPT` en el sentido típico de documentación Microsoft (aunque la app puede seguir intentando otros modos para otras instalaciones).
- Por eso **Compras Verdu** incorpora un modo explícito de verificación **legado ELAB** además de texto plano, MD5, bcrypt y rutas con `PWDCOMPARE`.

## Implementación en el proyecto

| Ubicación | Rol |
|-----------|-----|
| `backend/src/lib/elabLegacyPassword.js` | `encodeElabLegacyClave`, `verifyElabLegacyClave` |
| `backend/src/lib/usuariosSqlServer.js` | Cadena de verificación de login (`EXTERNAL_USUARIOS_PASSWORD_MODE=auto` incluye `elab_legacy`) |
| `backend/scripts/analyze-usuario-2558-clave.js` | Diagnóstico contra SQL Server (tipo de columna, muestra de `Clave`, pruebas) |

Variable de entorno relevante:

- `EXTERNAL_USUARIOS_PASSWORD_MODE=auto` (recomendado): prueba varios métodos, entre ellos el legado ELAB.
- `EXTERNAL_USUARIOS_PASSWORD_MODE=elab_legacy`: solo este método (útil para pruebas puntuales).

## Notas operativas

- Si en el futuro **ELAB** cambiara el formato de `Clave`, habría que ajustar o ampliar la lógica en `elabLegacyPassword.js` y mantener compatibilidad con las cuentas existentes.
- La **base de datos PostgreSQL** de Compras Verdu (usuarios locales, roles, etc.) **no** usa este cifrado: solo aplica a la fila de **ELABASTECEDOR** cuando el login externo está activo (`EXTERNAL_AUTH_LOGIN`).
