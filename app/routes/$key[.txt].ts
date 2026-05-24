import envVars from "~/lib/envVars.server";
import type { Route } from "./+types/$key[.txt]";

/**
 * Responds with the API key only if route is /$key.txt, so you have to know the
 * key to check this route.
 *
 *
 * @see https://www.indexnow.org/en/documentation/indexing-with-indexnow
 */
export function loader({ params }: Route.LoaderArgs) {
  if (params.key !== envVars.INDEXNOW_KEY) throw new Response(null, { status: 404 });
  return new Response(params.key, {
    headers: { "Content-Type": "text/plain" },
  });
}
