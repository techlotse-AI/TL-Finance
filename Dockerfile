# syntax=docker/dockerfile:1
# Multi-stage build. The runner ships only Next.js standalone output (app + the
# traced subset of node_modules), so the published image stays small; dev
# dependencies and the full module tree never reach it. The migrator installs
# with --omit=dev so the dev toolchain never reaches a credential-holding image
# either. BuildKit cache mounts keep `npm ci` fast across builds without
# bloating any layer.
#
# The base tag is pinned to the multi-arch manifest-list digest: every npm
# dependency is exact-pinned, so the OS layer must be too — otherwise the image
# the Trivy gate scanned is not guaranteed to be the image the next build
# produces. Dependabot (docker ecosystem) bumps the tag and digest together.
# CI injects org.opencontainers.image.{revision,source,version} at publish;
# the static identity labels below cover locally built images.

FROM node:26.5.0-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.title="TL Finance" \
      org.opencontainers.image.description="Docker-first, privacy-focused, multi-currency household finance application" \
      org.opencontainers.image.licenses="LicenseRef-Techlotse-Source-Available"
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
# Production dependencies only: the prisma CLI is a runtime dependency of this
# image (which is why it lives in package.json `dependencies`, not dev), and
# the dev toolchain must never ship in an image that holds database
# credentials.
FROM base AS migrator
ENV NODE_ENV=production
ENV HOME=/tmp
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --global npm@11.16.0 \
    && npm ci --omit=dev --no-audit --no-fund --prefer-offline
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/restore-platform-backup.mjs ./scripts/restore-platform-backup.mjs
RUN npx prisma generate
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# --- Runtime image (minimal standalone server) ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
# `public` stays root-owned on purpose: it is read-only at runtime, and
# root-owned files are immutable to the app user. `.next` is chowned because
# Next.js writes its ISR/prerender cache there (same split as the official
# Next.js Dockerfile).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "server.js"]
