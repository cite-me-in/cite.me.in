import debug from "debug";
import { HttpResponse, http, passthrough } from "msw";
import { setupServer } from "msw/node";
import anthropic from "./mswAnthropic";
import gemini from "./mswGemini";
import openai from "./mswOpenAI";
import perplexity from "./mswPerplexity";
import stripe from "./mswStripe";

const logger = debug("msw");

const handlers = [
  anthropic,
  gemini,
  openai,
  perplexity,
  stripe,

  http.get("https://example.com/", () =>
    HttpResponse.html("<html><body><p>Hello world</p></body></html>"),
  ),

  // Return empty results for SerpAPI by default; tests can override with server.use()
  http.get("https://serpapi.com/search", () =>
    HttpResponse.json({ organic_results: [] }),
  ),

  // Make sure we're not sending emails in tests
  http.post("https://api.resend.com/emails", () =>
    HttpResponse.json({ id: crypto.randomUUID() }),
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

  // Block any other external HTTP services not explicitly mocked.
  // When STRIPE_SECRET_KEY is set, allow Stripe API calls through to the real network.
  http.all(
    ({ request }: { request: Request }) => {
      if (process.env.STRIPE_SECRET_KEY) {
        const host = new URL(request.url).hostname;
        if (host === "api.stripe.com" || host.endsWith(".stripe.com"))
          return false;
      }
      return true;
    },
    ({ request }: { request: Request }) => {
      logger("Blocked %s request to: %s", request.method, request.url);
      return HttpResponse.json(
        { error: "External HTTP requests are not allowed in tests" },
        { status: 503 },
      );
    },
  ),
];

export const server = setupServer(...handlers);

// Add logging for debugging
server.events
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
  server.listen({ onUnhandledRequest: "warn" });
}
