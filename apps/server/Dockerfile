# syntax=docker/dockerfile:1
# Debian rather than Alpine: better-sqlite3 ships glibc prebuilds and needs no toolchain.

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:26-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build -w @fleet-tracker/shared
WORKDIR /repo/apps/server
RUN npx prisma generate
RUN npm run build -w @fleet-tracker/server

# ── migrate ───────────────────────────────────────────────────────────────────
# Runs once, then exits. Keeping the Prisma CLI here rather than in the runtime
# image is what removes ~190 MB from the container that actually serves traffic:
# the CLI drags in studio-core, the schema engine and their dependency trees.
FROM builder AS migrate
WORKDIR /repo/apps/server
# Runs as root, so it also hands the data volume to the unprivileged uid the
# runtime image uses — Docker creates a named volume owned by root.
CMD ["sh", "-c", "npx prisma migrate deploy && chown -R node:node /data"]

# ── production dependencies ───────────────────────────────────────────────────
# A clean --omit=dev install rather than `npm prune`, which leaves other
# workspaces' packages behind in a monorepo.
FROM node:26-slim AS prod-deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev

# @prisma/client declares the CLI and typescript as `peerOptional`, and npm installs
# optional peers by default — so `--omit=dev` alone still drags in the CLI, Studio,
# the schema engine and their trees. With a driver adapter none of that is used at
# runtime: queries go through better-sqlite3, and migrations run in the migrate
# stage. Dropping it halves node_modules, 423 MB -> 211 MB.
RUN rm -rf \
      node_modules/prisma \
      node_modules/typescript \
      node_modules/effect \
      node_modules/@electric-sql \
      node_modules/@prisma/studio-core \
      node_modules/@prisma/dev \
      node_modules/@prisma/engines \
      node_modules/@prisma/fetch-engine \
      node_modules/@prisma/get-platform

# The generated client is produced by the CLI, which only exists in the builder.
# `prisma-client-js` emits into node_modules/.prisma/client; @prisma/client is only
# a re-export of it, so both have to come across or the runtime cannot resolve it.
COPY --from=builder /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /repo/node_modules/@prisma/client ./node_modules/@prisma/client

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:26-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/fleet-tracker.db"

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
COPY --from=builder /repo/apps/server/package.json ./apps/server/package.json

# The image owns its data directory: a named volume mounted here inherits this
# ownership, so the runner works even when deployed without the migrate service.
RUN mkdir -p /data && chown node:node /data

USER node
WORKDIR /repo/apps/server
EXPOSE 3001
CMD ["node", "dist/main.js"]
