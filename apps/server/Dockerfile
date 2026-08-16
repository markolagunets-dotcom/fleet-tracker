# syntax=docker/dockerfile:1
# Debian rather than Alpine: better-sqlite3 ships glibc prebuilds and needs no toolchain.
FROM node:24-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build -w @fleet-tracker/shared
WORKDIR /repo/apps/server
RUN npx prisma generate
RUN npm run build -w @fleet-tracker/server

FROM node:24-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/fleet-tracker.db"

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
COPY --from=builder /repo/apps/server/package.json ./apps/server/package.json
COPY --from=builder /repo/apps/server/prisma ./apps/server/prisma
COPY --from=builder /repo/apps/server/prisma.config.ts ./apps/server/prisma.config.ts

WORKDIR /repo/apps/server
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
