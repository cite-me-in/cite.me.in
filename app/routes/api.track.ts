import debug from "debug";
import { data } from "react-router";
import { z } from "zod";
import recordBotVisit, { classifyBot } from "~/lib/botTracking.server";
import recordHumanVisit from "~/lib/humanTracking.server";
import prisma from "~/lib/prisma.server";

const logger = debug("server");

const TrackSchema = z.object({
  apiKey: z.string().min(1),
  url: z.url(),
  userAgent: z.string().nullable().optional().default(null),
  accept: z.string().nullable().optional().default(null),
  ip: z.string().nullable().optional().default(null),
  referer: z.string().nullable().optional().default(null),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  throw new Response("Method not allowed", {
    status: 405,
    headers: CORS_HEADERS,
  });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });

  let parsed: unknown;
  try {
    parsed = (await request.json()) as z.infer<typeof TrackSchema>;
  } catch (error) {
    logger("api.track: invalid JSON", error instanceof Error ? error.stack : String(error));
    throw new Response("Invalid JSON", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const { data: inputs, error } = TrackSchema.safeParse(parsed);
  if (error) {
    logger("api.track: invalid schema", error.message);
    throw new Response(error.message, { status: 404, headers: CORS_HEADERS });
  }

  const site = await prisma.site.findFirst({
    where: {
      OR: [
        { domain: new URL(inputs.url).hostname },
        { domain: new URL(inputs.url).hostname.replace(/^[^.]+\./, "") },
      ],
      apiKey: inputs.apiKey,
    },
  });
  if (!site) {
    logger("api.track: not found", { url: inputs.url, apiKey: inputs.apiKey });
    throw new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  }

  const userAgent = inputs.userAgent ?? request.headers.get("user-agent") ?? "Unknown";
  const ip = inputs.ip ?? request.headers.get("x-forwarded-for");

  try {
    if (classifyBot(userAgent)) {
      await recordBotVisit({
        accept: inputs.accept,
        ip,
        referer: inputs.referer,
        site,
        url: inputs.url,
        userAgent,
      });
      return data({ ok: true }, { headers: CORS_HEADERS });
    } else {
      await recordHumanVisit({
        ip,
        referer: inputs.referer,
        site,
        userAgent,
        url: inputs.url,
      });
      return data({ ok: true }, { headers: CORS_HEADERS });
    }
  } catch (error) {
    logger("api.track: error tracking visit", error instanceof Error ? error.stack : String(error));
    throw new Response("Bad Request", { status: 400, headers: CORS_HEADERS });
  }
}
