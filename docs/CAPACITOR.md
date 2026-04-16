# Compilar APK con Capacitor

## Requisitos

1. **Node.js >= 22** — Capacitor CLI 8 lo exige. En la raíz del repo y en `frontend/` hay un **`.nvmrc`** con `22`. Comprobá la versión con `node -v`. Si tenés **Node 18 u otra menor**, los scripts `apk:build` / `apk:release` fallan en el chequeo `[android:doctor]`; podés **instalar Node 22** (por ejemplo [nvm](https://github.com/nvm-sh/nvm) + `nvm install` y `nvm use` en el repo, o NodeSource en Linux: ver `scripts/install-node22-linux.sh`) **o** compilar la APK **solo con Docker** (siguiente sección), sin cambiar Node en el host.
2. **Android Studio** (reciente) y **Android SDK Platform 36** instalado (**SDK Manager** → *Android API 36* o la plataforma que pida el proyecto). Sin esa plataforma, Gradle falla con “failed to find target” o errores en `checkDebugAarMetadata`.
3. **JDK 21 para Gradle** — Capacitor 8 compila el proyecto Android con **Java 21**. En Android Studio: **File → Settings** (o **Android Studio → Settings** en macOS) → **Build, Execution, Deployment** → **Build Tools** → **Gradle** → **Gradle JDK**: elegí **JDK 21** (p. ej. **jbr-21** del propio Studio o **Temurin 21**). Si queda en JDK 17, el sync / la compilación suelen fallar con errores de versión de bytecode o del compilador.

## Configurar la URL del API (importante para la app móvil)

En la app móvil, el backend no puede ser `localhost`. Debes usar la IP de tu servidor:

1. Crea un archivo `.env` en `frontend/` (puedes copiar `.env.example`)
2. Define la URL del backend. Ejemplo para servidor en la misma red:
   ```
   VITE_API_URL=http://192.168.1.100:4000/api
   ```
3. Recompila: `npm run apk` (desde la raíz del repo; ver abajo).

## Monorepo: `npx cap` desde la raíz del repo

El CLI de Capacitor (`cap`) está instalado en **`frontend/`**, no en la raíz del monorepo. Si estás en `C:\ComprasVerdu` (o la raíz del proyecto) y ejecutás `npx cap sync android`, npm responde **`could not determine executable to run`** porque no hay ningún paquete que exponga `cap` ahí.

**Desde la raíz del repo (recomendado):**

```bash
npm run sync:android      # cap sync android en frontend/
npm run cap:open:android  # cap open android
```

**O** entrá al frontend y usá Capacitor como siempre:

```bash
cd frontend
npx cap sync android
```

## Flujo de trabajo

### Miniaturas de artículos (`/img/articulos/…`)

En el monorepo, la carpeta **`img/` en la raíz** suele estar **gitignored** (assets pesados). Para que la **APK** incluya esas imágenes al compilar:

- Colocá (o sincronicé) los JPG en `img/articulos/` en la raíz del repo, como en el entorno de build Docker.
- Los scripts **`npm run apk`**, **`npm run apk:build`** y **`npm run apk:release`** ejecutan antes del build un paso que **copia `img/` → `frontend/public/img/`** si esa carpeta existe. Si no existe, el build sigue (solo no habrá miniaturas locales empaquetadas).
- También podés poner los JPG directamente en **`frontend/public/img/articulos/`** (quedan en el `dist` al compilar). La planilla usa la ruta `/img/articulos/{codigo}.jpg` en web y en APK.

### Abrir el proyecto correcto en Android Studio

Abrí la carpeta del **módulo Android**, no la raíz del monorepo:

- Ruta: **`frontend/android`** (la que contiene `build.gradle`, `settings.gradle` y `app/`).

Si abrís solo `frontend/` o la raíz `ComprasVerdu/`, Gradle no encuentra la estructura esperada y el sync falla.

### Sincronizar y abrir en Android Studio

Desde **`frontend/`**:

```bash
npm run apk          # vite build + cap sync android
npm run cap:android  # sync android + abre Android Studio
```

Desde la **raíz del monorepo** (sin `cd frontend`):

```bash
npm run build        # solo compila el web a frontend/dist
npm run sync:android # copia dist → android (requiere build previo)
npm run cap:open:android
```

### Generar la APK en Android Studio

1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)** (variante **debug** para pruebas locales).
2. APK **debug**: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

**Release sin firma:** el build release genera **`app-release-unsigned.apk`** en `.../apk/release/`. Para Play Store o instalación “firmada” usá **Build → Generate Signed App Bundle / APK** y configurá un keystore. Si solo ves error al “compilar release” en Studio, probá primero **debug**; si debug funciona y release no, casi siempre es tema de **firma**, no del código.

### Generar APK desde línea de comandos (Windows, macOS, Linux)

```bash
cd frontend
npm run apk:build
```

Equivale a `vite build`, `cap sync android` y `assembleDebug` con `gradlew` / `gradlew.bat` según el sistema.

APK debug: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Para un **release local** (APK sin firmar para pruebas internas):

```bash
cd frontend
npm run apk:release
```

Salida: `frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Compilar la APK con Docker (sin Node 22 ni Android SDK en el host)

Si la máquina tiene **Node anterior a la 22** o no querés instalar Android SDK / Gradle localmente, podés generar la **APK debug** dentro de un contenedor (el Dockerfile instala Node 22, JDK y el SDK necesario).

**Requisito:** [Docker Engine](https://docs.docker.com/engine/install/) disponible en el PATH.

Desde la **raíz del monorepo**:

```bash
npm run apk:docker
```

Equivale a ejecutar `bash scripts/build-apk-docker.sh`: construye la imagen definida en `frontend/docker/apk/Dockerfile`, corre el build web, `cap sync android` y `assembleDebug`, y **copia la APK al host**.

**Salida en el host:** `frontend/app-debug.apk` (mismo artefacto debug que en Gradle local, pero ruta fija en la raíz de `frontend/` para descargas o CI).

La primera ejecución descarga imágenes base y dependencias; las siguientes suelen ser más rápidas.

## Si el build falla en Android Studio

| Síntoma | Qué revisar |
|--------|-------------|
| `[android:doctor] Se requiere Node.js >= 22` al ejecutar `npm run apk:build` | Actualizá Node a **22+** (`.nvmrc` en el repo) o usá **`npm run apk:docker`** desde la raíz sin instalar Node 22 en el sistema. |
| “SDK android-36 not found” / “failed to find target” / `checkDebugAarMetadata` | **SDK Manager** → pestaña **SDK Platforms** → marcá **Android API 36** (o la versión que indique el error) y **Apply**. Instalá también **Android SDK Build-Tools** recientes en la pestaña **SDK Tools**. |
| Errores de Java 21 / “release 21” / bytecode | **Gradle JDK = 21** (ver requisitos arriba). |
| Sync OK pero “OutOfMemoryError” en Gradle | Ya subimos memoria en `android/gradle.properties`; cerrá otros procesos o subí `-Xmx` un poco más. |
| No aparece ninguna APK “release” firmada | Es normal sin keystore: usá **debug** o **Generate Signed Bundle / APK**. |

## Probar en emulador o dispositivo

- Conecta un dispositivo Android con depuración USB activada
- En Android Studio: **Run** (▶️) para instalar y ejecutar
- O desde terminal: `npx cap run android`

## Error "failed to fetch" o "HOST UNREACHABLE" en celular físico

Si al iniciar sesión desde la app en el celular ves **"No se pudo conectar al servidor"** y el código para reportar es **NOROUTETOHOST** (o el mensaje dice "HOST UNREACHABLE" / NoRouteToHostException), el celular no puede alcanzar la PC donde corre el backend. Seguí los mismos pasos que abajo:

1. **Verifica la IP de tu PC**: En PowerShell ejecutá `ipconfig` y buscá la IPv4 de tu adaptador WiFi (ej: 192.168.1.99). Actualizá `frontend/.env` con esa IP.

2. **Firewall de Windows**: El firewall puede bloquear conexiones entrantes. Ejecutá como **Administrador**:
   ```powershell
   .\scripts\allow-backend-firewall.ps1
   ```

3. **Prueba desde el navegador del celular**: Abrí Chrome en el celular y andá a `http://TU_IP:4000/api/health`. Si ves `{"ok":true}` la red está bien. Si no carga, es firewall o IP incorrecta.

4. **Backend corriendo**: Asegurate de tener `npm run dev:backend` ejecutándose en la PC.

5. **Misma red**: El celular debe estar conectado a la **misma red WiFi** que la PC (no uses datos móviles en el celular para probar la app).
