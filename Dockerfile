# syntax=docker/dockerfile:1.7

# ============================================================
#  Backend NestJS — Fundecodes Digital
#  Build multi-stage. Base Node 20 Alpine.
# ============================================================

# ---------- Stage 1: dependencias completas (incluye dev) ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
# Instala TODO (dev + prod) y ejecuta prisma generate vía postinstall
RUN npm ci

# ---------- Stage 2: build ----------
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Reinstalamos SÓLO prod para la imagen final (reduce tamaño y superficie),
# pero MANTENEMOS el CLI de `prisma` porque el runtime lo necesita para
# ejecutar `prisma migrate deploy` en el arranque (ver CMD del runner).
# Fijamos la versión exacta para que coincida con @prisma/client ya instalado.
RUN npm prune --omit=dev \
 && npm install --no-save prisma@6.19.2

# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Usuario no-root
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

# Carpeta de uploads (montar volumen en producción)
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs
EXPOSE 4000

# Healthcheck sobre el endpoint /healthz del Nest
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:4000/healthz || exit 1

# tini se encarga de PID 1 y señales (ctrl-c / docker stop limpio)
ENTRYPOINT ["/sbin/tini", "--"]

# Aplica migraciones y arranca la app.
# Usamos el binario local de prisma (./node_modules/.bin/prisma) explícitamente
# para evitar que npx intente descargar otra versión.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
