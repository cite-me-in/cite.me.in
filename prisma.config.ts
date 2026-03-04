import { resolve } from "node:path";
import { defineConfig } from "prisma/config";
import envVars from "./app/lib/envVars";

// @see https://www.prisma.io/docs/orm/overview/databases/supabase#specific-considerations
export default defineConfig({
  datasource: {
    url: new URL(envVars.DATABASE_URL).toString(),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
  typedSql: { path: resolve("prisma", "sql") },
});
