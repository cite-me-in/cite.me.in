import prisma from "~/lib/prisma.server";

export async function verifyBearerToken(
  token: string | undefined,
): Promise<string> {
  if (!token) throw new Error("Missing token");
  const accessToken = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });
  if (!accessToken || accessToken.expiresAt < new Date())
    throw new Error("Invalid or expired token");
  return accessToken.userId;
}
