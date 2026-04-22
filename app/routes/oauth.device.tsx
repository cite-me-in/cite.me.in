import { redirect } from "react-router";
import { requireUserAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/oauth.device";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  await requireUserAccess(request);

  if (!code) return { code: null, deviceCode: null };

  const deviceCode = await prisma.oAuthDeviceCode.findFirst({
    where: { code },
    select: {
      id: true,
      clientId: true,
      scopes: true,
      createdAt: true,
      expiresIn: true,
      client: { select: { name: true } },
    },
  });

  if (!deviceCode) return { code, deviceCode: null, error: "Invalid code" };

  const expiresAt = new Date(
    deviceCode.createdAt.getTime() + deviceCode.expiresIn * 1000,
  );
  if (expiresAt < new Date()) {
    await prisma.oAuthDeviceCode.delete({ where: { code } });
    return { code, deviceCode: null, error: "Code expired" };
  }

  return {
    code,
    deviceCode: {
      clientName: deviceCode.client.name,
      scopes: deviceCode.scopes,
    },
    deviceCodeId: deviceCode.id,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const deviceCodeId = formData.get("device_code_id") as string;

  const { user } = await requireUserAccess(request);

  if (formData.get("deny")) {
    await prisma.oAuthDeviceCode.delete({ where: { id: deviceCodeId } });
    return redirect("/oauth/device?denied=1");
  }

  await prisma.oAuthDeviceCode.update({
    where: { id: deviceCodeId },
    data: { userId: user.id },
  });

  return redirect("/oauth/device?approved=1");
}

export default function Device({ loaderData }: Route.ComponentProps) {
  const { code, deviceCode, deviceCodeId, error } = loaderData;
  const url = new URL(
    typeof window !== "undefined" ? window.location.href : "http://localhost",
  );
  const denied = url.searchParams.get("denied");
  const approved = url.searchParams.get("approved");

  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-600">You denied access to the application.</p>
        </div>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold">Approved!</h1>
          <p className="text-gray-600">
            You can close this window and return to the application.
          </p>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
          <h1 className="mb-4 text-2xl font-bold">Device Activation</h1>
          <p className="mb-4 text-gray-600">
            Enter the code shown on your device:
          </p>
          <form method="get" className="flex gap-2">
            <input
              type="text"
              name="code"
              placeholder="XXXX"
              className="flex-1 rounded border px-3 py-2 text-center text-2xl tracking-widest uppercase"
              maxLength={8}
            />
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !deviceCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error || "Invalid code"}</p>
          <a
            href="/oauth/device"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-4 text-2xl font-bold">
          Authorize {deviceCode.clientName}
        </h1>
        <p className="mb-6 text-gray-600">
          This application is requesting access to your account with the
          following permissions:
        </p>
        <ul className="mb-6 space-y-2">
          {deviceCode.scopes.map((scope) => (
            <li key={scope} className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>{scope}</span>
            </li>
          ))}
        </ul>
        <form method="post" className="flex gap-3">
          <input type="hidden" name="device_code_id" value={deviceCodeId} />
          <button
            type="submit"
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
