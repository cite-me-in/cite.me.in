#!/bin/bash

# Update the production database to the latest schema changes:
#
# Usage: ./scripts/db-push.sh

set -euo pipefail
echo "Updating production database..."
infisical --env prod run -- pnpm prisma db push
echo "Done."
