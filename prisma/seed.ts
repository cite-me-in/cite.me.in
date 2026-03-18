import prisma from "~/lib/prisma.server";

console.info("Seeding database…");
console.info("✅ Done.");
await prisma.$disconnect();
