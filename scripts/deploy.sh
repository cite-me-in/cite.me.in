#!/usr/bin/env bash

# Deploy the application to the production environment. This will run the tests,
# generate the types, update the database, and deploy to Vercel. This always
# deploys to production and does not require promotion, so use with care.
#
# Usage: ./scripts/deploy.sh

set -eo pipefail

echo -e "\033[32m  Checking code is clean …\033[0m"
biome lint
secretlint "**/*" --format stylish

echo -e "\033[32m  Generating React Router types …\033[0m"
pnpm react-router typegen

echo -e "\033[32m  Checking types …\033[0m"
pnpm tsc --noEmit --strict

echo -e "\033[32m  Installing Playwright …\033[0m"
pnpm exec playwright install

echo -e "\033[32m  Running tests …\033[0m"
NODE_OPTIONS="--max-old-space-size=3096" vitest run

echo -e "\033[32m  Running Playwright tests …\033[0m"
NODE_OPTIONS="--max-old-space-size=3096" playwright test

echo -e "\033[32m  Updating database …\033[0m"
infisical --env prod run -- pnpm prisma db push

echo -e "\033[32m  Deploying to Vercel …\033[0m"
vc build --prod
vc deploy --prod --prebuilt

echo -e "\033[32m  Opening dashboard …\033[0m"
open "https://cite.me.in"
