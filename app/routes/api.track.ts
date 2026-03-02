import { captureException } from "@sentry/react-router";
import { z } from "zod";
import { recordBotVisit } from "~/lib/botTracking.server";
import type { Route } from "./+types/api.track";

const BotTrackSchema = z.object({
  url: z.url(),
  userAgent: z.string(),
  accept: z.string(),
  ip: z.string(),
  referer: z.string().optional(),
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
    console.error("Invalid JSON", body);
    captureException(new Error("Invalid JSON"), { extra: { body } });
    return Response.json(
      { tracked: false, reason: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { url: rawUrl, userAgent, accept, ip, referer } = data;
  const { tracked, reason } = await recordBotVisit({
    url: rawUrl,
    userAgent,
    accept,
    ip,
    referer: referer ?? null,
  });
  return Response.json({ tracked, reason }, { headers: CORS_HEADERS });
}

export async function loader() {
  return Response.json(
    { tracked: false, reason: "Method not allowed" },
    { status: 405 },
  );
}
