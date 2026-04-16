import envVars from "~/lib/envVars.server";

export function loader() {
  return Response.json({
    issuer: envVars.VITE_APP_URL,
    authorization_endpoint: new URL(
      "/oauth/authorize",
      envVars.VITE_APP_URL,
    ).toString(),
    token_endpoint: new URL("/oauth/token", envVars.VITE_APP_URL).toString(),
    registration_endpoint: new URL(
      "/oauth/register",
      envVars.VITE_APP_URL,
    ).toString(),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp:tools", "mcp:resources"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  });
}
