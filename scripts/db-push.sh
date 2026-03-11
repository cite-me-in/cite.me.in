#!/bin/bash

set -euo pipefail

export POSTGRES_PRISMA_URL=$(doppler --config prd secrets get POSTGRES_PRISMA_URL --plain)

echo "Updating production database..."
pnpm prisma db push

echo "Done."
