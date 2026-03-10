import { z } from "zod";
import prisma from "~/lib/prisma.server";
import recordBotVisit from "~/lib/botTracking.server";
import type { Route } from "./+types/api.track";

const BotTrackSchema = z.object({
  url: z.url(),
  userAgent: z.string().nullable().optional(),
  accept: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  referer: z.string().nullable().optional(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function forbidden() {
  return Response.json(
    { tracked: false, reason: "Forbidden" },
    { status: 403, headers: CORS_HEADERS },
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (request.method !== "POST")
    return Response.json(
      { tracked: false, reason: "Method not allowed" },
      { status: 405, headers: CORS_HEADERS },
    );

  let body: unknown;
  let data: z.infer<typeof BotTrackSchema>;
  try {
    body = await request.json();
    const parsed = BotTrackSchema.safeParse(body);
    if (parsed.error) throw new Error(parsed.error.message);
    data = parsed.data;
  } catch {
    return Response.json(
      { tracked: false, reason: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return forbidden();
  const apiKey = authHeader.slice(7);

  const hostname = new URL(data.url).hostname.toLowerCase();
  const site = await prisma.site.findFirst({
    where: { domain: hostname, account: { apiKey } },
  });
  if (!site) return forbidden();

  const { url: rawUrl, userAgent, accept, ip, referer } = data;
  const { tracked, reason } = await recordBotVisit({
    url: rawUrl,
    userAgent: userAgent || null,
    accept: accept || null,
    ip: ip || null,
    referer: referer || null,
    site,
  });
  return Response.json({ tracked, reason }, { headers: CORS_HEADERS });
}

export async function loader() {
  return Response.json(
    { tracked: false, reason: "Method not allowed" },
    { status: 405 },
  );
}
