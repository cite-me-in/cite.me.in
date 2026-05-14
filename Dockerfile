FROM node:24-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# --- DEPS ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- BUILDER ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG INFISICAL_ENV
COPY .env .env
RUN pnpm build

# --- RUNNER ---
FROM node:24-slim AS runner
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Retry with timeout (workaround for Colima TCP connection drops to Azure CDN)
RUN for i in $(seq 1 3); do \
        timeout 600 npx -y playwright@1.59.1 install chromium --with-deps && break; \
        echo "Attempt $i failed, retrying in 15s..."; \
        sleep 15; \
    done
RUN corepack enable pnpm

WORKDIR /app

ENV HOST="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma/generated ./prisma/generated
COPY --from=builder /app/prisma/prod-ca-2021.crt ./prisma/prod-ca-2021.crt
COPY --from=builder /app/app/data ./app/data
COPY --from=builder /app/app/cron ./app/cron
COPY --from=builder /app/.env .env
COPY package.json pnpm-lock.yaml ./

RUN chmod 644 .env

USER node

CMD ["pnpm", "start"]
