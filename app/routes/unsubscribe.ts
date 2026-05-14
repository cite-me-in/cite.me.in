import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/unsubscribe";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) return new Response("Invalid unsubscribe link", { status: 400 });

  const expectedToken = generateUnsubscribeToken(email);
  if (token !== expectedToken) return new Response("Invalid unsubscribe token", { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return new Response("User not found", { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { unsubscribed: true },
  });

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribed — Cite.me.in</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f6f9fc; }
    .card { background: white; padding: 2rem; border-radius: 8px; text-align: center; max-width: 400px; }
    h1 { color: #1f2937; }
    p { color: #6b7280; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>You've been unsubscribed from weekly digest emails.</p>
    <p><a href="${import.meta.env.VITE_APP_URL}">Return to Cite.me.in</a></p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    },
  );
}
