import { data } from "react-router";
import { generateToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.register";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data({ error: "invalid_request" }, { status: 405 });
  }

  let body: {
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    scope?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    throw data({ error: "invalid_request" }, { status: 400 });
  }

  const {
    client_name = "MCP Client",
    redirect_uris = [],
    grant_types = ["authorization_code", "refresh_token"],
    response_types = ["code"],
    token_endpoint_auth_method = "none",
    scope = "mcp:tools",
  } = body;

  if (!redirect_uris || redirect_uris.length === 0)
    throw data(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris is required",
      },
      { status: 400 },
    );

  for (const uri of redirect_uris) {
    try {
      const url = new URL(uri);
      if (url.protocol !== "http:" && url.protocol !== "https:")
        throw new Error("Invalid protocol");
      if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
        throw data(
          {
            error: "invalid_redirect_uri",
            error_description: "HTTP redirect URIs only allowed for localhost",
          },
          { status: 400 },
        );
    } catch (e) {
      if (e instanceof Response) throw e;
      throw data(
        {
          error: "invalid_redirect_uri",
          error_description: `Invalid redirect URI: ${uri}`,
        },
        { status: 400 },
      );
    }
  }

  const clientId = generateToken(16);
  const clientSecret = token_endpoint_auth_method === "none" ? "" : generateToken(32);
  const scopes = scope.split(" ").filter(Boolean);

  const client = await prisma.oAuthClient.create({
    data: {
      name: client_name,
      clientId,
      clientSecret,
      redirectUris: redirect_uris,
      scopes,
    },
  });

  const response: Record<string, unknown> = {
    client_id: client.clientId,
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types,
    response_types,
    token_endpoint_auth_method,
    scope: scopes.join(" "),
  };

  if (token_endpoint_auth_method !== "none") {
    response.client_secret = clientSecret;
    response.client_secret_expires_at = 0;
  }

  return data(response, { status: 201 });
}
