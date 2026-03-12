/**
 * NOTE: This is used by `db seed` (prisma/seed.ts) but also when running test
 * suite (test/helpers/globalSetup.ts)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import debug from "debug";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { PrismaClient } from "prisma/generated/client";
import envVars from "./envVars";

// Configure pg Pool for Supabase pooler (SSL configured via POSTGRES_URL)
const pool = new pg.Pool({
  connectionString: envVars.POSTGRES_URL,
  max: 1,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0,
  allowExitOnIdle: true,
  ssl: process.env.NODE_ENV === "production" && {
    cert: readFileSync(resolve("prisma/prod-ca-2021.crt")),
    rejectUnauthorized: false,
  },
});

export default new PrismaClient({
  adapter: new PrismaPg(pool),
  errorFormat: "pretty",
  log: debug.enabled("prisma") ? ["error", "warn", "query", "info"] : ["error"],
});
