import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

if (process.env.NODE_ENV === "test") dotenv.config({ path: ".env.test", quiet: true });
dotenv.config({ path: ".env", quiet: true });

// @see https://www.prisma.io/docs/orm/overview/databases/supabase#specific-considerations
export default defineConfig({
  datasource: {
    // Use process.env directly so prisma generate doesn't throw when the var
    // is absent (e.g. on a build server that has no DB access).
    url: env("POSTGRES_URL_NON_POOLING"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
  typedSql: { path: resolve("prisma", "sql") },
});
