import { beforeEach, describe, expect, it } from "vite-plus/test";
import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchServer";

async function unsubscribe(params: Record<string, string>) {
  const url = new URL(`http://localhost:${port}/unsubscribe`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return await fetch(url.toString());
}

describe("unsubscribe", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "unsub" } } });
  });

  it("should return 400 without params", async () => {
    const res = await fetch(`http://localhost:${port}/unsubscribe`);
    expect(res.status).toBe(400);
  });

  it("should return 400 with invalid token", async () => {
    await prisma.user.create({
      data: {
        id: "user-unsub-1",
        email: "unsub1@test.com",
        passwordHash: "test",
      },
    });

    const res = await unsubscribe({
      token: "bad-token",
      email: "unsub1@test.com",
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 with unknown email", async () => {
    const token = generateUnsubscribeToken("nobody@test.com");
    const res = await unsubscribe({ token, email: "nobody@test.com" });
    expect(res.status).toBe(400);
  });

  it("should set unsubscribed=true with valid token and email", async () => {
    await prisma.user.create({
      data: {
        id: "user-unsub-2",
        email: "unsub2@test.com",
        passwordHash: "test",
      },
    });

    const token = generateUnsubscribeToken("unsub2@test.com");
    const res = await unsubscribe({ token, email: "unsub2@test.com" });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { id: "user-unsub-2" },
    });
    expect(user?.unsubscribed).toBe(true);
  });
});
