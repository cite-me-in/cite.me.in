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

COPY .env.docker .env

RUN pnpm build

# --- RUNNER ---
FROM node:24-slim AS runner
ENV NODE_ENV=production

RUN npm install -g @infisical/cli

RUN corepack enable pnpm

WORKDIR /app

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.pnpm/node_modules/@prisma/engines ./build/node_modules/.pnpm/node_modules/@prisma/engines
COPY --from=builder /app/prisma/generated ./prisma/generated
COPY --from=builder /app/prisma/prod-ca-2021.crt ./prisma/prod-ca-2021.crt
COPY --from=builder /app/app/data ./app/data
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile 2>/dev/null || true

USER node

CMD ["infisical", "run", "--env", "prod", "--", "pnpm", "start"]
