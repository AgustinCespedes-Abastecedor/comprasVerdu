# =============================================================================
# Dockerfile Frontend Compras Verdu (Vite + React → Nginx)
# =============================================================================
# En producción la API se llama por /api (proxy en nginx hacia backend:4000).
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
# public/img suele ser symlink a ../../img; dentro del contenedor el destino no existe y vite build falla.
RUN rm -rf public/img
RUN mkdir -p public/img

RUN npm run build

# -----------------------------------------------------------------------------
# Production (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
