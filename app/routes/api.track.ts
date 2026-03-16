import { z } from "zod";
import recordHumanVisit, {
  isHumanBrowser,
} from "~/lib/humanTracking.server";
import recordBotVisit from "~/lib/botTracking.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.track";

const TrackSchema = z.object({
  url: z.url(),
  userAgent: z.string().nullable().optional(),
  accept: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  referer: z.string().nullable().optional(),
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
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

  let data: z.infer<typeof TrackSchema>;
  try {
    const body = await request.json();
    const parsed = TrackSchema.safeParse(body);
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
    where: { domain: hostname, apiKey },
  });
  if (!site) return forbidden();

  const { url, userAgent, accept, ip, referer, utmSource } = data;

  if (!userAgent)
    return Response.json(
      { tracked: false, reason: "no user agent" },
      { headers: CORS_HEADERS },
    );

  // 1. Try bot classification first
  const botResult = await recordBotVisit({
    url,
    userAgent,
    accept: accept ?? null,
    ip: ip ?? null,
    referer: referer ?? null,
    site,
  });
  if (botResult.tracked || botResult.reason !== "not a bot")
    return Response.json(botResult, { headers: CORS_HEADERS });

  // 2. Fall through to human tracking if UA looks like a real browser
  if (!isHumanBrowser(userAgent))
    return Response.json(
      { tracked: false, reason: "unrecognized agent" },
      { headers: CORS_HEADERS },
    );

  const humanResult = await recordHumanVisit({
    url,
    userAgent,
    ip: ip ?? null,
    referer: referer ?? null,
    utmSource: utmSource ?? null,
    site,
  });
  return Response.json(humanResult, { headers: CORS_HEADERS });
}

export async function loader() {
  return Response.json(
    { tracked: false, reason: "Method not allowed" },
    { status: 405 },
  );
}
