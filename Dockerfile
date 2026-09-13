# Two entrypoints from one image: the Next.js web app (default) and the
# collector (override the command). Node 24 for node:sqlite and native TS.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Inlined into the browser bundle at build time; compose passes it from .env.
ARG NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-rpc.publicnode.com
ENV NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL
RUN npm run build

# Production dependencies for the collector, which runs from src/ and is not
# covered by the standalone trace of the web app.
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV AFTER_HOURS_DB=/data/after-hours.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Full production node_modules first, then the standalone output overlays its
# traced subset on top (same files, so nothing is lost).
COPY --from=prod-deps /app/node_modules ./node_modules
# Web app (standalone output) plus the source the collector needs.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src

RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
