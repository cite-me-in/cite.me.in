import bcrypt from "bcryptjs";
import type { Site, User } from "prisma/generated/client";
import prisma from "~/lib/prisma.server";

export default async function seedSite(): Promise<Site> {
  const user = await seedAccount();
  return await seedSites(user);
}

async function seedAccount(): Promise<User> {
  const apiKey = "cite.me.in_21945ffb0342eb204b60aaf28c7bdca9";
  const account = await prisma.account.upsert({
    where: { id: "cmm4h5qam000004l75z7mobty" },
    update: { apiKey },
    create: { id: "cmm4h5qam000004l75z7mobty", apiKey },
  });

  const user = await prisma.user.upsert({
    where: { id: "cmm4h5qb5000104l75s5fu1de" },
    update: {},
    create: {
      id: "cmm4h5qb5000104l75s5fu1de",
      email: "assaf@labnotes.org",
      passwordHash: await bcrypt.hash("EhnGjs7JMsq3oKrkfwZk", 1),
      account: { connect: { id: account.id } },
    },
    include: { account: true },
  });
  console.info("✅ User: %s (%s)", user.id, user.email);
  return user;
}

async function seedSites(user: User): Promise<Site> {
  const rentail = await prisma.site.upsert({
    where: {
      id: "cmm6i5m3p0000mfrcir8ilttq",
    },
    update: {},
    create: {
      id: "cmm6i5m3p0000mfrcir8ilttq",
      accountId: user.accountId,
      content:
        "rentail .space  Sign In  🎉 Rent for days, weeks, or months Find Your Next Mall Space in Under 2 Minutes Find short-term retail spaces in shopping centers—without the broker meetings or endless phone calls. Built for small businesses and seasonal sellers. Just instant matches with spaces ready for your products. Find My Match Why Choose rentail .space? Short-term retail spaces in shopping centers near you.",
      domain: "rentail.space",
    },
  });

  const citeMeIn = await prisma.site.upsert({
    where: {
      id: "cmm6jgk1u0000f5rcxmtgpwga",
    },
    update: {},
    create: {
      id: "cmm6jgk1u0000f5rcxmtgpwga",
      accountId: user.accountId,
      content:
        "Cite.me.in Sign in Get started The Search Console for AI Does ChatGPT mention  your brand? Cite.me.in runs your queries across ChatGPT, Claude, Gemini, and Perplexity — and records every time they cite your website.",
      domain: import.meta.env.VITE_APP_URL,
    },
  });
  console.info("✅ Sites: %s, %s", rentail.id, citeMeIn.id);
  return rentail;
}
