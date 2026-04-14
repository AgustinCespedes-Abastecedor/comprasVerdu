/**
 * Comprueba Node (Capacitor 8), JDK y Android SDK antes de Gradle.
 * Mensajes orientados a acción (local + CI + Docker).
 *
 * Omitir comprobaciones: SKIP_ANDROID_ENV_CHECK=1 (solo emergencias).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, '..');
const androidDir = path.join(frontendRoot, 'android');

const MIN_NODE_MAJOR = 22;
const REQUIRED_PLATFORM = 'android-36';

function fail(message) {
  console.error(`\n[android:doctor] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[android:doctor] Aviso: ${message}`);
}

function parseSdkDirFromLocalProperties(content) {
  const line = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('sdk.dir='));
  if (!line) return null;
  let raw = line.slice('sdk.dir='.length).trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  return raw.replace(/\\\\/g, '\\');
}

function resolveAndroidSdkRoot() {
  const localProps = path.join(androidDir, 'local.properties');
  if (existsSync(localProps)) {
    try {
      const content = readFileSync(localProps, 'utf8');
      const sdkDir = parseSdkDirFromLocalProperties(content);
      if (sdkDir && existsSync(sdkDir)) return { root: sdkDir, source: 'local.properties (sdk.dir)' };
      if (sdkDir) {
        warn(`sdk.dir en local.properties apunta a una ruta inexistente: ${sdkDir}`);
      }
    } catch {
      warn('No se pudo leer android/local.properties');
    }
  }
  const fromEnv =
    process.env.ANDROID_HOME?.trim() ||
    process.env.ANDROID_SDK_ROOT?.trim() ||
    '';
  if (fromEnv && existsSync(fromEnv)) {
    return { root: fromEnv, source: 'ANDROID_HOME / ANDROID_SDK_ROOT' };
  }
  return null;
}

function checkNode() {
  const major = Number.parseInt(process.version.slice(1).split('.')[0], 10);
  if (Number.isNaN(major) || major < MIN_NODE_MAJOR) {
    fail(
      `Se requiere Node.js >= ${MIN_NODE_MAJOR} (Capacitor CLI 8). Versión actual: ${process.version}.\n` +
        'Soluciones:\n' +
        '  • En la raíz del repo: `bash scripts/install-node22-linux.sh` (instrucciones nvm / NodeSource).\n' +
        '  • Con nvm: `nvm install` y `nvm use` (hay `.nvmrc` con 22 en la raíz y en `frontend/`).\n' +
        '  • Sin Node 22 en el host: desde la raíz del repo `npm run apk:docker` (solo Docker; genera `frontend/app-debug.apk`).\n' +
        '  • Emergencia: `SKIP_ANDROID_ENV_CHECK=1` (no recomendado).',
    );
  }
}

function checkJava() {
  const javaHome = process.env.JAVA_HOME?.trim();
  if (javaHome) {
    const javaBin = path.join(javaHome, 'bin', 'java');
    if (!existsSync(javaBin)) {
      fail(
        `JAVA_HOME está definido (${javaHome}) pero no existe ${javaBin}.\n` +
          'Ajustá JAVA_HOME al directorio raíz del JDK (no al JRE suelto).',
      );
    }
  }

  const versionProbe = spawnSync('java', ['-version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const stderr = versionProbe.stderr || '';
  if (versionProbe.status !== 0 && !stderr) {
    fail(
      'No se encontró el comando `java`. Instalá un JDK 21 (recomendado para este proyecto) y asegurate de que esté en el PATH.\n' +
        'En Ubuntu/Debian: `sudo apt install openjdk-21-jdk` y exportá `JAVA_HOME` (p. ej. `/usr/lib/jvm/java-21-openjdk-amd64`).\n' +
        'Alternativa: `npm run docker:apk` desde `frontend/`.',
    );
  }

  const match = stderr.match(/version "(\d+)/);
  const major = match ? Number.parseInt(match[1], 10) : 0;
  if (major > 0 && major < 17) {
    fail(
      `La versión de Java detectada es demasiado antigua (${stderr.split('\n')[0] ?? 'desconocida'}). ` +
        'Usá JDK 17 como mínimo; este repo compila el módulo Android con Java 21.',
    );
  }
  if (major > 0 && major < 21) {
    warn(
      'Se detectó Java < 21. El proyecto declara compatibilidad Java 21 en `android/app/build.gradle`; si Gradle falla, actualizá a JDK 21.',
    );
  }

  if (!javaHome) {
    warn(
      'JAVA_HOME no está definido. Si Gradle falla, definí JAVA_HOME explícitamente apuntando al JDK (mejor reproducibilidad que solo `java` en PATH).',
    );
  }
}

function checkAndroidSdk() {
  const resolved = resolveAndroidSdkRoot();
  if (!resolved) {
    fail(
      'No se encontró el Android SDK.\n' +
        '1) Creá `frontend/android/local.properties` con una línea `sdk.dir=/ruta/al/Android/sdk` (ver `local.properties.example`), o\n' +
        '2) Definí la variable de entorno ANDROID_HOME (o ANDROID_SDK_ROOT) con la ruta del SDK.\n' +
        'Instalación típica: Android Studio → SDK Manager, o solo "command line tools".\n' +
        'Necesitás la plataforma API 36 (compileSdk 36 del proyecto).\n' +
        'Alternativa: `npm run docker:apk` desde `frontend/`.',
    );
  }

  const platformDir = path.join(resolved.root, 'platforms', REQUIRED_PLATFORM);
  if (!existsSync(platformDir)) {
    fail(
      `SDK detectado (${resolved.source}: ${resolved.root}) pero falta la plataforma ${REQUIRED_PLATFORM}.\n` +
        `Instalá el paquete con el SDK Manager, por ejemplo:\n` +
        `  sdkmanager "platforms;android-36" "platform-tools" "build-tools;36.0.0"`,
    );
  }

  const buildTools = path.join(resolved.root, 'build-tools');
  if (!existsSync(buildTools)) {
    warn(`No existe la carpeta build-tools bajo el SDK; Gradle puede descargar herramientas, pero conviene instalar build-tools 36.x.`);
  }

  console.log(
    `[android:doctor] OK — Node ${process.version}, SDK (${resolved.source}): ${resolved.root}`,
  );
}

function checkGradlew() {
  const gradlew = path.join(androidDir, 'gradlew');
  if (!existsSync(gradlew)) {
    fail('No se encontró android/gradlew. Ejecutá `npm ci` y verificá el proyecto Capacitor.');
  }
  if (process.platform !== 'win32') {
    try {
      const mode = statSync(gradlew).mode;
      const executable = (mode & 0o111) !== 0;
      if (!executable) {
        warn(
          'gradlew no tiene permiso de ejecución; `run-gradle.mjs` intentará corregirlo en tiempo de build.',
        );
      }
    } catch {
      /* ignorar */
    }
  }
}

function main() {
  if (process.env.SKIP_ANDROID_ENV_CHECK === '1') {
    console.warn('[android:doctor] SKIP_ANDROID_ENV_CHECK=1 — se omiten comprobaciones (no recomendado).');
    process.exit(0);
  }

  checkNode();
  checkGradlew();
  checkJava();
  checkAndroidSdk();
}

main();
