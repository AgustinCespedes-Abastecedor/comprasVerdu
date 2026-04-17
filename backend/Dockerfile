# =============================================================================
# Dockerfile Backend Compras Verdu (Node/Express + Prisma)
# =============================================================================
# Entrada: node src/index.js. Sin build TypeScript.
# =============================================================================

FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# --ignore-scripts evita postinstall (ensure-prisma.js) que requiere scripts/; generamos Prisma abajo
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate

# -----------------------------------------------------------------------------
# Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src
COPY scripts ./scripts

RUN chown -R expressjs:nodejs node_modules/.prisma node_modules/@prisma

USER expressjs

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/health || exit 1

# migrate deploy antes del servidor (equivalente al script prestart de npm start en desarrollo manual).
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
