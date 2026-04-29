import * as Sentry from "@sentry/react-router";
import { handleRequest } from "@vercel/react-router/entry.server";
import { initLogger, wrapTraced } from "braintrust";
import debug from "debug";
import type {
  ActionFunctionArgs,
  EntryContext,
  LoaderFunctionArgs,
} from "react-router";
import "~/lib/logger.server";
import captureAndLogError from "./lib/captureAndLogError.server";
import envVars from "./lib/envVars.server";
import { trackVisits } from "./lib/trackVisits.server";

switch (process.env.NODE_ENV) {
  case "production": {
    // Initialize Braintrust logger
    initLogger({ projectName: "cite.me.in" });

    Sentry.init({
      dsn: envVars.VITE_SENTRY_DSN,
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
    break;
  }
  case "test": {
    // NOTE: Make sure we don't accidentally load MSW in dev/production.
    void import("~/test/helpers/worker.setup").then(
      ({ default: setupTestServer }) => {
        setupTestServer();
      },
    );
    break;
  }
}

const logger = debug("server");

export function getLoadContext() {
  return {};
}

export default wrapTraced(
  Sentry.wrapSentryHandleRequest(
    async (
      request: Request,
      responseStatusCode: number,
      responseHeaders: Headers,
      routerContext: EntryContext,
      loadContext?: any,
    ) => {
      if (import.meta.env.PROD) void trackVisits(request);
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
      void waitForResponse(response, start).then((duration) => {
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
  ),
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
  void waitForResponse(response, start).then((duration) => {
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
    captureAndLogError(error, { extra: { request } });
    logger("error: %s", error);
  }
}
