import { PassThrough } from "node:stream";
import * as Sentry from "@sentry/react-router";
import debug from "debug";
import { renderToPipeableStream } from "react-dom/server";
import type {
  ActionFunctionArgs,
  AppLoadContext,
  EntryContext,
  LoaderFunctionArgs,
} from "react-router";
import { ServerRouter } from "react-router";
import "~/lib/logger.server";
import captureAndLogError from "./lib/captureAndLogError.server";
import { trackVisits } from "./lib/trackVisits.server";

if (import.meta.env.MODE === "test") {
  void import("~/test/helpers/worker.setup").then(
    ({ default: setupTestServer }) => {
      setupTestServer();
    },
  );
}

const logger = debug("server");

export function getLoadContext() {
  return {};
}

export default Sentry.wrapSentryHandleRequest(
  async (
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    _loadContext?: AppLoadContext,
  ) => {
    if (import.meta.env.PROD) void trackVisits(request);
    const start = Date.now();
    logger("%s %s", request.method, request.url);

    const response = await new Promise<Response>((resolve, reject) => {
      const { pipe } = renderToPipeableStream(
        <ServerRouter
          context={routerContext}
          url={request.url}
          nonce={crypto.randomUUID()}
        />,
        {
          onShellReady() {
            responseHeaders.set("Content-Type", "text/html");
            const body = new PassThrough();
            resolve(
              new Response(body as unknown as BodyInit, {
                status: responseStatusCode,
                headers: responseHeaders,
              }),
            );
            pipe(body);
          },
          onShellError(error) {
            reject(error);
          },
          onError(error) {
            if (!responseHeaders.has("Content-Type")) reject(error);
          },
        },
      );
    });

    if (!response.ok) return response;

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
