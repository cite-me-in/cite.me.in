/**
 * Track visits in database
 */

import captureAndLogError from "./captureAndLogError.server";
import envVars from "./envVars.server";

export async function trackVisits(request: Request): Promise<void> {
  try {
    await fetch(new URL("/api/track", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${envVars.TRACK_API_KEY}`,
      },
      body: JSON.stringify({
        accept: request.headers.get("accept"),
        ip: request.headers.get("x-forwarded-for"),
        referer: request.headers.get("referer"),
        url: request.url.toString(),
        userAgent: request.headers.get("user-agent"),
      }),
    });
  } catch (error) {
    captureAndLogError(error, { extra: { request } });
  }
}
