import * as Sentry from "@sentry/react-router";
import { handleRequest } from "@vercel/react-router/entry.server";
import { wrapTraced } from "braintrust";
import debug from "debug";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import type {
  ActionFunctionArgs,
  EntryContext,
  LoaderFunctionArgs,
} from "react-router";
import "~/lib/logger.server";
import captureAndLogError from "./lib/captureAndLogError.server";
import { trackVisits } from "./lib/trackVisits.server";

switch (process.env.NODE_ENV) {
  case "test": {
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

      const url = new URL(request.url);
      const isMdExtension = url.pathname.endsWith(".md");
      const mdUrl = isMdExtension
        ? new URL(
            url.pathname.replace(/\.md$/, "").replace(/\/index$/, "/") +
              url.search,
            url.origin,
          ).href
        : request.url;
      const mdRequest = isMdExtension ? new Request(mdUrl, request) : request;

      const response = await handleRequest(
        mdRequest,
        responseStatusCode,
        responseHeaders,
        routerContext,
        loadContext,
        { nonce: crypto.randomUUID() },
      );

      if (!response.ok) return response;

      const wantsMarkdown =
        isMdExtension ||
        mdRequest.headers.get("Accept")?.includes("text/markdown");

      if (!wantsMarkdown) {
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

      try {
        const html = await response.clone().text();
        const { document } = parseHTML(html);
        const result = await Defuddle(document, mdUrl, {
          markdown: true,
        });
        void waitForResponse(
          new Response(result.content, {
            status: response.status,
            headers: { "Content-Type": "text/markdown" },
          }),
          start,
        ).then((duration) => {
          logger(
            "%s %s => %d (%dms)",
            request.method,
            request.url,
            response.status,
            duration,
          );
        });
        return new Response(result.content, {
          status: response.status,
          headers: { "Content-Type": "text/markdown" },
        });
      } catch (error) {
        logger("Defuddle failed: %s", error);
        if (isMdExtension) throw new Response("Not found", { status: 404 });
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
