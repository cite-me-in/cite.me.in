import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import seedSite from "./seed/seedSite";
import seedSiteQueries from "./seed/seedSiteQueries";

console.info("Seeding database…", envVars.POSTGRES_PRISMA_URL);
const site = await seedSite();
await seedSiteQueries(site);
console.info("✅ Done.");
await prisma.$disconnect();
