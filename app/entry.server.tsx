import * as Sentry from "@sentry/react-router";
import { handleRequest } from "@vercel/react-router/entry.server";
import debug from "debug";
import type {
  ActionFunctionArgs,
  EntryContext,
  LoaderFunctionArgs,
} from "react-router";
import "~/lib/logger.server";
import msw from "~/test/mocks/msw";
import { createBotTracker } from "./lib/botTracker";
import captureException from "./lib/captureException.server";
import envVars from "./lib/envVars";

if (import.meta.env.PROD)
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enableLogs: true,
    environment: "production",
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
      Sentry.anthropicAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
      Sentry.vercelAIIntegration({ recordInputs: true, recordOutputs: true }),
    ],
    tracesSampleRate: 1.0,
  });

// Initialize MSW in test mode (on the server side)
if (process.env.NODE_ENV === "test") msw();

const logger = debug("server");

const tracker = createBotTracker({
  apiKey: envVars.BOT_TRACKER_API_KEY,
  endpoint: envVars.BOT_TRACKER_URL,
});

export function getLoadContext() {
  return {};
}

export default Sentry.wrapSentryHandleRequest(
  async (
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    // biome-ignore lint/suspicious/noExplicitAny: Sentry wrapper requires flexible type
    loadContext?: any,
  ) => {
    if (import.meta.env.PROD) tracker.track(request); // fire-and-forget, production only
    const start = Date.now();
    logger("%s %s", request.method, request.url);

    const response = await handleRequest(
      request,
      responseStatusCode,
      responseHeaders,
      routerContext,
      loadContext,
      { nonce: crypto.randomUUID() },
    );
    waitForResponse(response, start).then((duration) => {
      logger(
        "%s %s => %d (%dms)",
        request.method,
        request.url,
        response.status,
        duration,
      );
    });
    return response;
  },
);

async function waitForResponse(response: Response, start: number) {
  const reader = response.clone().body?.getReader();
  if (reader) {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }
  return Date.now() - start;
}

export function handleDataRequest(
  response: Response,
  { request }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  const start = Date.now();
  logger("%s %s", request.method, request.url);
  waitForResponse(response, start).then((duration) => {
    logger(
      "%s %s => %d (%dms)",
      request.method,
      request.url,
      response.status,
      duration,
    );
  });
  return response;
}

export function handleError(
  error: unknown,
  { request }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  if (!request.signal.aborted) {
    captureException(error, { extra: { request } });
    logger("error: %s", error);
  }
}
