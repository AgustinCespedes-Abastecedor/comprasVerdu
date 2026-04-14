# Imagen reproducible para generar la APK sin depender del JDK/SDK del host (Node 22 dentro de la imagen).
#
# Desde la raíz del monorepo (recomendado: construye la imagen y copia el APK a frontend/app-debug.apk):
#   npm run apk:docker
#
# Solo construir la imagen (desde frontend/):
#   npm run docker:apk
#
# El APK en la imagen queda en:
#   /app/android/app/build/outputs/apk/debug/app-debug.apk

FROM eclipse-temurin:21-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=22.14.0
RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in amd64) node_arch=x64 ;; arm64) node_arch=arm64 ;; *) echo "unsupported arch: $arch"; exit 1 ;; esac; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.gz" \
    | tar -xz -C /usr/local --strip-components=1

ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
  && curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdline.zip \
  && unzip -q /tmp/cmdline.zip -d "${ANDROID_HOME}/cmdline-tools" \
  && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
  && rm /tmp/cmdline.zip

RUN yes | sdkmanager --licenses >/dev/null \
  && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

RUN npm run apk:build
