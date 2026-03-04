import debug from "debug";
import { HttpResponse, http, passthrough } from "msw";
import { setupServer } from "msw/node";

const logger = debug("msw");

const handlers = [
  // Make sure we're not sending emails in tests
  http.post("https://api.resend.com/emails", () =>
    HttpResponse.json({ id: crypto.randomUUID() }),
  ),

  // Mock Anthropic API for LLM calls (query suggestions)
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = await request.text();
    const requestQueries = body.includes(
      "generate search queries a user might type into an AI platform",
    );
    if (requestQueries) {
      logger("Mocking LLM response for query suggestions");
      return HttpResponse.json({
        id: `msg_test_${crypto.randomUUID()}`,
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              elements: [
                { group: "1. discovery", query: "Query 1" },
                { group: "1. discovery", query: "Query 2" },
                { group: "1. discovery", query: "Query 3" },
                { group: "2. active_search", query: "Query 4" },
                { group: "2. active_search", query: "Query 5" },
                { group: "2. active_search", query: "Query 6" },
                { group: "3. comparison", query: "Query 7" },
                { group: "3. comparison", query: "Query 8" },
                { group: "3. comparison", query: "Query 9" },
              ],
            }),
          },
        ],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      });
    } else {
      return HttpResponse.json({
        id: `msg_test_${crypto.randomUUID()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "I'm sorry, I can't help with that." }],
      });
    }
  }),

  http.get("https://example.com/", () =>
    HttpResponse.html("<html><body><p>Hello world</p></body></html>"),
  ),

  // Allow all localhost requests to pass through (for dev server communication)
  http.all(
    ({ request }: { request: Request }) =>
      new URL(request.url).hostname === "localhost",
    () => passthrough(), // Pass through to real server
  ),

  // Allow images, fonts, and other assets to fail gracefully
  http.get(
    /\.(jpg|jpeg|png|gif|webp|woff|woff2|ttf|svg|css|ico|eot)(\?.*)?$/i,
    () => new HttpResponse(null, { status: 204 }), // No content
  ),

  // Block any other external HTTP services not explicitly mocked
  http.all(
    () => true,
    ({ request }: { request: Request }) => {
      logger("Blocked %s request to: %s", request.method, request.url);
      return HttpResponse.json(
        { error: "External HTTP requests are not allowed in tests" },
        { status: 503 },
      );
    },
  ),
];

const msw = setupServer(...handlers);

// Add logging for debugging
msw.events
  .on("request:start", ({ request }: { request: Request }) =>
    logger("%s", request.method, request.url),
  )
  .on(
    "response:mocked",
    ({ request, response }: { request: Request; response: Response }) => {
      logger("%s %s => %s", request.method, request.url, response.status);
    },
  )
  .on("request:unhandled", ({ request }: { request: Request }) => {
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
    ({ request, error }: { request: Request; error: Error }) => {
      debug("server:msw")("%s %s errored!", request.method, request.url, error);
    },
  );

export default function listen() {
  msw.listen({ onUnhandledRequest: "error" });
}
