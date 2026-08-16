# syntax=docker/dockerfile:1
FROM node:24-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build -w @fleet-tracker/shared && npm run build -w @fleet-tracker/web

FROM node:24-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

# Next's standalone server binds HOSTNAME; leaving it unset risks a loopback bind
# inside the container, where the published port then goes nowhere.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER node

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
