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
ARG POSTGRES_URL_NON_POOLING=postgresql://dummy:dummy@localhost:5432/dummy
ARG POSTGRES_URL=postgresql://dummy:dummy@localhost:5432/dummy?pgbouncer=true
ARG ANTHROPIC_API_KEY=sk-dummy
ARG TRACK_API_KEY=dummy
ARG REDIS_URL=redis://localhost:6379
ARG RESEND_API_KEY=re_dummy
ARG SESSION_SECRET=dummy
ARG VITE_APP_URL=http://localhost:3000
ARG VITE_EMAIL_FROM=test@cite.me.in
ARG ZHIPU_API_KEY=dummy
ARG OPENAI_API_KEY=sk-dummy
ARG PERPLEXITY_API_KEY=pplx-dummy
ARG GOOGLE_GENERATIVE_AI_API_KEY=AIza-dummy
ARG SERPAPI_API_KEY=dummy
ARG STRIPE_SECRET_KEY=sk_test_dummy
ARG INDEXNOW_KEY=
ENV POSTGRES_URL_NON_POOLING=$POSTGRES_URL_NON_POOLING
ENV POSTGRES_URL=$POSTGRES_URL
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV TRACK_API_KEY=$TRACK_API_KEY
ENV REDIS_URL=$REDIS_URL
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV SESSION_SECRET=$SESSION_SECRET
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_EMAIL_FROM=$VITE_EMAIL_FROM
ENV ZHIPU_API_KEY=$ZHIPU_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
ENV GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY
ENV SERPAPI_API_KEY=$SERPAPI_API_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV INDEXNOW_KEY=$INDEXNOW_KEY
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
