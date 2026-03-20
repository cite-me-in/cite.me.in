#!/bin/bash
set -euo pipefail

echo "Updating production database..."
infisical --env prod run -- pnpm prisma db push

echo "Done."
