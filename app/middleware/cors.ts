const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function corsMiddleware(
  { request }: { request: Request },
  next: () => Promise<Response>,
) {
  // If the route itself has a loader that handles OPTIONS, we defer to it by calling next().
  if (request.method === "OPTIONS") {
    const response = await next();
    // If the route didn't handle OPTIONS (i.e., responded with 404), fallback to generic 204 response.
    return response.status === 404
      ? new Response(null, {
          status: 204,
          headers: corsHeaders,
        })
      : response;
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
