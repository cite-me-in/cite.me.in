/**
 * Track visits in database
 */

import { action } from "~/routes/api.track";
import captureAndLogError from "./captureAndLogError.server";
import envVars from "./envVars.server";

/**
 * Track human or bot visit. Uses `/api/track` endpoint to track visits to this
 * specific webapp.
 *
 * @param request - The request to track
 * @returns A promise that resolves when the visits are tracked.
 */
export async function trackVisits(request: Request): Promise<void> {
  try {
    const newRequest = new Request(
      new URL("/api/track", import.meta.env.VITE_APP_URL),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: envVars.TRACK_API_KEY,
          accept: request.headers.get("accept"),
          ip: request.headers.get("x-forwarded-for"),
          referer: request.headers.get("referer"),
          url: request.url.toString(),
          userAgent: request.headers.get("user-agent"),
        }),
      },
    );
    await action({ request: newRequest });
  } catch (error) {
    captureAndLogError(error, { extra: { request } });
  }
}
