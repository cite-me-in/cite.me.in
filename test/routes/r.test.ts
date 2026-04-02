import { afterEach, describe, it, expect } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import envVars from "~/lib/envVars.server";
import { port } from "../helpers/launchBrowser";

const BASE = `http://localhost:${port}`;
const DEST = `${envVars.VITE_APP_URL}/sites`;

afterEach(() => prisma.user.deleteMany({ where: { email: { contains: "r-route-test" } } }));

describe("/r proxy route", () => {
  it("should redirect to url and mark emailVerifiedAt when token is valid", async () => {
    const email = "r-route-test-1@example.com";
    await prisma.user.create({
      data: { id: "r-route-1", email, passwordHash: await hashPassword("x") },
    });
    const token = generateUnsubscribeToken(email);
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(DEST);

    const user = await prisma.user.findUnique({ where: { id: "r-route-1" } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("should not overwrite emailVerifiedAt if already set", async () => {
    const email = "r-route-test-2@example.com";
    const verifiedAt = new Date("2025-01-01");
    await prisma.user.create({
      data: { id: "r-route-2", email, passwordHash: await hashPassword("x"), emailVerifiedAt: verifiedAt },
    });
    const token = generateUnsubscribeToken(email);
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    await fetch(url.toString(), { redirect: "manual" });

    const user = await prisma.user.findUnique({ where: { id: "r-route-2" } });
    expect(user?.emailVerifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
  });

  it("should still redirect when token is invalid", async () => {
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", "r-route-test-3@example.com");
    url.searchParams.set("token", "bad-token");

    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(DEST);
  });

  it("should redirect to / when url param is missing", async () => {
    const url = new URL("/r", BASE);
    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });
});
