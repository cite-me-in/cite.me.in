FROM node:24-slim AS base

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
RUN --mount=type=secret,id=infisical_token \
  INFISICAL_TOKEN=$(cat /run/secrets/infisical_token) \
  ./node_modules/.bin/infisical export --env="$INFISICAL_ENV" --token="$INFISICAL_TOKEN" > .env

RUN pnpm build

# --- RUNNER ---
FROM node:24-slim AS runner
ENV NODE_ENV=production

RUN corepack enable pnpm

WORKDIR /app

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma/generated ./prisma/generated
COPY --from=builder /app/prisma/prod-ca-2021.crt ./prisma/prod-ca-2021.crt
COPY --from=builder /app/app/data ./app/data
COPY --from=builder /app/.env .env
COPY package.json pnpm-lock.yaml ./

USER node

CMD ["pnpm", "start"]
