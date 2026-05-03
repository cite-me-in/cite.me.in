/**
 * NOTE: This is used by `db seed` (prisma/seed.ts) but also when running test
 * suite (test/helpers/globalSetup.ts)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import debug from "debug";
import { PrismaClient } from "~/prisma";
import envVars from "./envVars.server";

export default new PrismaClient({
  adapter: new PrismaPg({
    connectionString: envVars.POSTGRES_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0,
    allowExitOnIdle: true,
    ssl: /localhost|127\.0\.0\.1/.test(envVars.POSTGRES_URL)
      ? false
      : {
          ca: readFileSync(resolve("prisma/prod-ca-2021.crt")),
          rejectUnauthorized: false,
        },
  }),
  errorFormat: "pretty",
  log: debug.enabled("prisma") ? ["error", "warn", "query", "info"] : ["error"],
});
