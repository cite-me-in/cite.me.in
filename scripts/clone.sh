#!/usr/bin/env bash
set -eo pipefail

# Clone production database to local development database
# Usage: ./scripts/clone.sh

# Load environment variables from Doppler and export DATABASE_URL
DIRECT_URL=$(doppler --config prd secrets get DIRECT_URL --plain)

# Dump the database to a file
echo -e "\033[32m  Dumping database to backup.sql …\033[0m"
pg_dump "$DIRECT_URL" --file prisma/backup.sql --schema public --clean --no-owner --no-privileges

# Restore the database from the file
echo -e "\033[32m  Restoring database from backup.sql …\033[0m"
psql postgresql://postgres:postgres@localhost:5432/postgres < prisma/backup.sql
# pg_restore --verbose --clean --file prisma/backup.sql --schema public

# Open the auth page
open "http://localhost:5173/"