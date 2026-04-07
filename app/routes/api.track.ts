import type { Route } from "./+types/api.track";
import { data } from "react-router";
import { z } from "zod";
import recordBotVisit, { classifyBot } from "~/lib/botTracking.server";
import recordHumanVisit from "~/lib/humanTracking.server";
import prisma from "~/lib/prisma.server";

const TrackSchema = z.object({
  url: z.url(),
  userAgent: z.string().nullable().optional().default(null),
  accept: z.string().nullable().optional().default(null),
  ip: z.string().nullable().optional().default(null),
  referer: z.string().nullable().optional().default(null),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  let inputs: z.infer<typeof TrackSchema>;
  try {
    const body = await request.json();
    const { data, error } = TrackSchema.safeParse(body);
    if (error) throw new Error(error.message);
    inputs = data;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const [tokenType, token] = authHeader?.split(" ") ?? [];
  if (tokenType !== "Bearer") return new Response("Forbidden", { status: 403 });
  const { hostname, searchParams } = new URL(inputs.url);
  const site = await prisma.site.findFirst({
    where: { domain: hostname, apiKey: token },
  });
  if (!site) return new Response("Forbidden", { status: 403 });

  const { userAgent } = inputs;
  if (!userAgent) return new Response("No user agent", { status: 400 });

  if (classifyBot(userAgent)) {
    const { tracked } = await recordBotVisit({
      accept: inputs.accept,
      ip: inputs.ip,
      referer: inputs.referer,
      site,
      url: inputs.url,
      userAgent,
    });
    return data({ ok: tracked }, { headers: CORS_HEADERS });
  } else {
    const utmSource = searchParams.get("utm_source");
    await recordHumanVisit({
      ip: inputs.ip,
      referer: inputs.referer,
      site,
      userAgent,
      utmSource,
    });
    return data({ ok: true }, { headers: CORS_HEADERS });
  }
}

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}
