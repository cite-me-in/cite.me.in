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
RUN pnpm build

# --- RUNNER ---
FROM node:24-slim AS runner
ENV NODE_ENV=production

RUN npx -y playwright@1.59.1 install --with-deps
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
COPY package.json pnpm-lock.yaml ./

RUN --mount=type=secret,id=dotenv cp /run/secrets/dotenv .env && chmod 644 .env

USER node

CMD ["pnpm", "start"]
