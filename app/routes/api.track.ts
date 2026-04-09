import { map } from "radashi";
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

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request }: { request: Request }) {
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

  const { hostname, searchParams } = new URL(inputs.url);
  const sites = await prisma.site.findMany({ where: { domain: hostname } });

  const userAgent =
    inputs.userAgent ?? request.headers.get("user-agent") ?? "Unknown";
  const ip = inputs.ip ?? request.headers.get("x-forwarded-for");

  if (classifyBot(userAgent)) {
    await map(sites, (site) =>
      recordBotVisit({
        accept: inputs.accept,
        ip,
        referer: inputs.referer,
        site,
        url: inputs.url,
        userAgent,
      }),
    );
    return data({ ok: true }, { headers: CORS_HEADERS });
  } else {
    await map(sites, (site) =>
      recordHumanVisit({
        ip,
        referer: inputs.referer,
        site,
        userAgent,
        utmSource: searchParams.get("utm_source"),
      }),
    );
    return data({ ok: true }, { headers: CORS_HEADERS });
  }
}
