# syntax=docker/dockerfile:1
# Multi-stage build. The runner ships only Next.js standalone output (app + the
# traced subset of node_modules), so the published image stays small; dev
# dependencies and the full module tree never reach it. BuildKit cache mounts
# keep `npm ci` fast across builds without bloating any layer.

FROM node:26.4.0-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Patch OS packages once; reused by every downstream stage that derives from base.
RUN apk upgrade --no-cache

# --- Install dependencies (cached on package manifests only) ---
FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --global npm@11.16.0 \
    && npm ci --no-audit --no-fund --prefer-offline

# --- Build the application ---
FROM dependencies AS builder
ENV DATABASE_URL=postgresql://build-only:build-only@127.0.0.1:5432/build-only
COPY . .
RUN npx prisma generate && npm run build

# --- Migrator image (runs `prisma migrate deploy`) ---
FROM dependencies AS migrator
ENV NODE_ENV=production
ENV HOME=/tmp
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/restore-platform-backup.mjs ./scripts/restore-platform-backup.mjs
RUN npx prisma generate
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# --- Runtime image (minimal standalone server) ---
FROM node:26.4.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk upgrade --no-cache \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "server.js"]
