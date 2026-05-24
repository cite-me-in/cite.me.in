import { data } from "react-router";
import { authenticateClient, createAccessToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.device.token";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const grantType = formData.get("grant_type");
  const clientId = formData.get("client_id") as string;
  const clientSecret = formData.get("client_secret") as string;
  const deviceCode = formData.get("device_code") as string;

  if (grantType !== "urn:ietf:params:oauth:grant-type:device_code")
    throw data({ error: "unsupported_grant_type" }, { status: 400 });

  const client = await authenticateClient(clientId, clientSecret);

  const storedDeviceCode = await prisma.oAuthDeviceCode.findUnique({
    where: { code: deviceCode },
    select: {
      id: true,
      userId: true,
      clientId: true,
      scopes: true,
      createdAt: true,
      expiresIn: true,
    },
  });

  if (!storedDeviceCode || storedDeviceCode.clientId !== client.id) {
    throw data({ error: "invalid_grant" }, { status: 400 });
  }

  const expiresAt = new Date(
    storedDeviceCode.createdAt.getTime() + storedDeviceCode.expiresIn * 1000,
  );
  if (expiresAt < new Date()) {
    await prisma.oAuthDeviceCode.delete({ where: { code: deviceCode } });
    throw data({ error: "expired_token" }, { status: 400 });
  }

  if (!storedDeviceCode.userId) throw data({ error: "authorization_pending" }, { status: 400 });

  await prisma.oAuthDeviceCode.delete({ where: { code: deviceCode } });

  const tokens = await createAccessToken({
    userId: storedDeviceCode.userId,
    clientId: client.id,
    scopes: storedDeviceCode.scopes,
  });

  return data({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: storedDeviceCode.scopes.join(" "),
  });
}
