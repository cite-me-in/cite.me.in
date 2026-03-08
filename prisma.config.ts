import { resolve } from "node:path";
import { defineConfig, env } from "prisma/config";

// @see https://www.prisma.io/docs/orm/overview/databases/supabase#specific-considerations
export default defineConfig({
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
  typedSql: { path: resolve("prisma", "sql") },
});
