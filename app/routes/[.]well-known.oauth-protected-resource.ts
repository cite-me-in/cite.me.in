import envVars from "~/lib/envVars.server";

export function loader() {
  return Response.json({
    resource: new URL("/mcp", envVars.VITE_APP_URL).toString(),
    authorization_servers: [envVars.VITE_APP_URL],
    scopes_supported: ["mcp:tools", "mcp:resources"],
  });
}
