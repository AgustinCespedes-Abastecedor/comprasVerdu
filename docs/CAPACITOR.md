# Compilar APK con Capacitor

## Requisitos

1. **Node.js** (ya lo tienes)
2. **Android Studio** - [Descargar](https://developer.android.com/studio)
3. **Java 17** (incluido con Android Studio)

## Configurar la URL del API (importante para la app móvil)

En la app móvil, el backend no puede ser `localhost`. Debes usar la IP de tu servidor:

1. Crea un archivo `.env` en `frontend/` (puedes copiar `.env.example`)
2. Define la URL del backend. Ejemplo para servidor en la misma red:
   ```
   VITE_API_URL=http://192.168.1.100:4000/api
   ```
3. Recompila: `npm run apk`

## Flujo de trabajo

### Sincronizar y abrir en Android Studio

```bash
cd frontend
npm run apk          # Compila el frontend y sincroniza con Android
npm run cap:android  # Abre el proyecto en Android Studio
```

### Generar la APK en Android Studio

1. Abre el proyecto: `npm run cap:android`
2. Menú **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. La APK se genera en `frontend/android/app/build/outputs/apk/debug/`

### Generar APK desde línea de comandos (Linux/Mac)

```bash
cd frontend
npm run apk:build
```

En **Windows** (PowerShell):

```bash
cd frontend
npm run apk
cd android
.\gradlew.bat assembleDebug
```

La APK estará en `android/app/build/outputs/apk/debug/app-debug.apk`

## Probar en emulador o dispositivo

- Conecta un dispositivo Android con depuración USB activada
- En Android Studio: **Run** (▶️) para instalar y ejecutar
- O desde terminal: `npx cap run android`
