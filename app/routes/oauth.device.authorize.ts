import { data } from "react-router";
import { DEVICE_CODE_EXPIRY, generateToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.device.authorize";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const clientId = formData.get("client_id") as string;
  const clientSecret = formData.get("client_secret") as string;
  const scope = (formData.get("scope") as string) || "";

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { id: true, clientSecret: true },
  });

  if (!client || client.clientSecret !== clientSecret)
    throw data({ error: "invalid_client" }, { status: 401 });

  const deviceCode = generateToken();
  const userCode = generateToken(4).toUpperCase();

  await prisma.oAuthDeviceCode.create({
    data: {
      code: deviceCode,
      clientId: client.id,
      scopes: scope.split(" ").filter(Boolean),
      expiresIn: DEVICE_CODE_EXPIRY,
    },
  });

  const baseUrl = new URL(request.url).origin;

  return data({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${baseUrl}/oauth/device`,
    verification_uri_complete: `${baseUrl}/oauth/device?code=${userCode}`,
    expires_in: DEVICE_CODE_EXPIRY,
    interval: 5,
  });
}
