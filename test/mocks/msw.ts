import debug from "debug";
import { HttpResponse, http, passthrough } from "msw";
import { setupServer } from "msw/node";

const logger = debug("msw");

const handlers = [
  http.get("https://example.com/", () =>
    HttpResponse.html("<html><body><p>Hello world</p></body></html>"),
  ),

  http.get("https://serpapi.com/search", () =>
    HttpResponse.json({ organic_results: [] }),
  ),

  http.post("https://api.resend.com/emails", () => {
    throw new Error(
      "Resend API called in test environment - this should never happen. " +
      "Check sendEmails.tsx test mode handling.",
    );
  }),

  http.post("https://api.z.ai/api/paas/v4/chat/completions", () =>
    HttpResponse.json({
      choices: [{ message: { content: "Mocked AI insight" } }],
    }),
  ),

  http.all(
    ({ request }: { request: Request; }) =>
      new URL(request.url).hostname === "localhost",
    () => passthrough(), // Pass through to real server
  ),

  // Allow images, fonts, and other assets to fail gracefully
  http.get(
    /\.(jpg|jpeg|png|gif|webp|woff|woff2|ttf|svg|css|ico|eot)(\?.*)?$/i,
    () => new HttpResponse(null, { status: 204 }), // No content
  ),

  // Block any other external HTTP services not explicitly mocked.
  http.all(
    () => true,
    ({ request }: { request: Request; }) => {
      logger("Blocked %s request to: %s", request.method, request.url);
      return HttpResponse.json(
        { error: "External HTTP requests are not allowed in tests" },
        { status: 503 },
      );
    },
  ),
];

const msw = setupServer(...handlers);
// Listen for unhandled requests
msw.listen({ onUnhandledRequest: "error" });

// Add logging for debugging
msw.events
  .on("request:start", ({ request }: { request: Request; }) =>
    logger("%s", request.method, request.url),
  )
  .on(
    "response:mocked",
    ({ request, response }: { request: Request; response: Response; }) => {
      logger("%s %s => %s", request.method, request.url, response.status);
    },
  )
  .on("request:unhandled", ({ request }: { request: Request; }) => {
    // Only log external requests that are being bypassed
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      logger(
        "Unhandled external request (bypassed): %s %s",
        request.method,
        request.url,
      );
    }
  })
  .on(
    "unhandledException",
    ({ request, error }: { request: Request; error: Error; }) => {
      debug("server:msw")("%s %s errored!", request.method, request.url, error);
    },
  );

export default msw;