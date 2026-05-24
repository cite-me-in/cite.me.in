import { data } from "react-router";
import { createAccessToken, generateCodeChallenge } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.token";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const grantType = formData.get("grant_type");
  const clientId = formData.get("client_id") as string;
  const clientSecret = formData.get("client_secret") as string;
  const code = formData.get("code") as string | null;
  const redirectUri = formData.get("redirect_uri") as string | null;
  const codeVerifier = formData.get("code_verifier") as string | null;
  const refreshToken = formData.get("refresh_token") as string | null;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { id: true, clientSecret: true },
  });

  if (!client) throw data({ error: "invalid_client" }, { status: 401 });

  if (client.clientSecret && client.clientSecret !== clientSecret)
    throw data({ error: "invalid_client" }, { status: 401 });

  if (grantType === "authorization_code") {
    if (!code || !redirectUri) throw data({ error: "invalid_request" }, { status: 400 });

    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
      where: { code },
      select: {
        userId: true,
        clientId: true,
        redirectUri: true,
        scopes: true,
        codeChallenge: true,
        expiresAt: true,
      },
    });

    if (!authCode || authCode.clientId !== client.id)
      throw data({ error: "invalid_grant" }, { status: 400 });

    if (authCode.expiresAt < new Date()) {
      await prisma.oAuthAuthorizationCode.delete({ where: { code } });
      throw data({ error: "invalid_grant", error_description: "Code expired" }, { status: 400 });
    }

    if (authCode.redirectUri !== redirectUri)
      throw data(
        { error: "invalid_grant", error_description: "Redirect URI mismatch" },
        { status: 400 },
      );

    if (authCode.codeChallenge && codeVerifier) {
      const expectedChallenge = generateCodeChallenge(codeVerifier);
      if (authCode.codeChallenge !== expectedChallenge) {
        throw data(
          {
            error: "invalid_grant",
            error_description: "PKCE verification failed",
          },
          { status: 400 },
        );
      }
    }

    await prisma.oAuthAuthorizationCode.delete({ where: { code } });

    const tokens = await createAccessToken({
      userId: authCode.userId,
      clientId: client.id,
      scopes: authCode.scopes,
    });

    return data({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: authCode.scopes.join(" "),
    });
  }

  if (grantType === "refresh_token") {
    if (!refreshToken) throw data({ error: "invalid_request" }, { status: 400 });

    const storedRefreshToken = await prisma.oAuthRefreshToken.findUnique({
      where: { token: refreshToken },
      select: { userId: true, clientId: true, scopes: true, expiresAt: true },
    });

    if (!storedRefreshToken || storedRefreshToken.clientId !== client.id)
      throw data({ error: "invalid_grant" }, { status: 400 });

    if (storedRefreshToken.expiresAt < new Date()) {
      await prisma.oAuthRefreshToken.delete({ where: { token: refreshToken } });
      throw data(
        { error: "invalid_grant", error_description: "Refresh token expired" },
        { status: 400 },
      );
    }

    await prisma.oAuthRefreshToken.delete({ where: { token: refreshToken } });

    const tokens = await createAccessToken({
      userId: storedRefreshToken.userId,
      clientId: client.id,
      scopes: storedRefreshToken.scopes,
    });

    return data({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: storedRefreshToken.scopes.join(" "),
    });
  }

  throw data({ error: "unsupported_grant_type" }, { status: 400 });
}
