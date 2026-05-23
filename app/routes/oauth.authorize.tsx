import { data, redirect } from "react-router";
import { requireUserAccess } from "~/lib/auth.server";
import { AUTH_CODE_EXPIRY, generateToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.authorize";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const scope = url.searchParams.get("scope") || "";
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");

  if (!clientId || !redirectUri)
    throw data(
      {
        error: "invalid_request",
        error_description: "Missing client_id or redirect_uri",
      },
      { status: 400 },
    );

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { id: true, name: true, redirectUris: true, scopes: true },
  });

  if (!client)
    throw data(
      { error: "invalid_client", error_description: "Unknown client" },
      { status: 400 },
    );

  if (!client.redirectUris.includes(redirectUri))
    throw data(
      {
        error: "invalid_redirect_uri",
        error_description: "Redirect URI not registered",
      },
      { status: 400 },
    );

  const { user } = await requireUserAccess(request);

  return {
    client: { name: client.name },
    scopes: scope.split(" ").filter(Boolean),
    redirectUri,
    state,
    codeChallenge,
    clientId: client.id,
    userId: user.id,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const clientIdParam = formData.get("client_id") as string;
  const userId = formData.get("user_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const scope = formData.get("scope") as string;
  const state = formData.get("state") as string | null;
  const codeChallenge = formData.get("code_challenge") as string | null;

  if (formData.get("deny")) {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    if (state) denyUrl.searchParams.set("state", state);
    return redirect(denyUrl.toString());
  }

  const client = await prisma.oAuthClient.findFirst({
    where: { OR: [{ id: clientIdParam }, { clientId: clientIdParam }] },
    select: { id: true },
  });

  if (!client)
    throw data(
      { error: "invalid_client", error_description: "Unknown client" },
      { status: 400 },
    );

  const code = generateToken();
  const now = new Date();

  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      userId,
      clientId: client.id,
      redirectUri,
      scopes: scope.split(" ").filter(Boolean),
      codeChallenge: codeChallenge || null,
      expiresAt: new Date(now.getTime() + AUTH_CODE_EXPIRY * 1000),
    },
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return redirect(callbackUrl.toString());
}

export default function Authorize({ loaderData }: Route.ComponentProps) {
  const {
    client,
    scopes,
    redirectUri,
    state,
    codeChallenge,
    clientId,
    userId,
  } = loaderData;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-4 text-2xl font-bold">Authorize {client.name}</h1>
        <p className="mb-6 text-gray-600">
          This application is requesting access to your account with the
          following permissions:
        </p>
        <ul className="mb-6 space-y-2">
          {scopes.map((scope) => (
            <li key={scope} className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>{scope}</span>
            </li>
          ))}
        </ul>
        <form method="post" className="flex gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="scope" value={scopes.join(" ")} />
          {state && <input type="hidden" name="state" value={state} />}
          {codeChallenge && (
            <input type="hidden" name="code_challenge" value={codeChallenge} />
          )}
          <button
            type="submit"
            name="allow"
            value="1"
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Allow
          </button>
          <button
            type="submit"
            name="deny"
            value="1"
            className="flex-1 rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
          >
            Deny
          </button>
        </form>
      </div>
    </div>
  );
}
