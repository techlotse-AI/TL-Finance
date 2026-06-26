FROM node:26.4.0-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk upgrade --no-cache
RUN npm install --global npm@11.16.0
RUN npm ci

FROM dependencies AS builder
WORKDIR /app
ENV DATABASE_URL=postgresql://build-only:build-only@127.0.0.1:5432/build-only
COPY . .
RUN npx prisma generate
RUN npm run build

FROM dependencies AS migrator
WORKDIR /app
ENV NODE_ENV=production
ENV HOME=/tmp
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/restore-platform-backup.mjs ./scripts/restore-platform-backup.mjs
RUN npx prisma generate
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:26.4.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk upgrade --no-cache \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "server.js"]
