import invariant from "tiny-invariant";
import { beforeAll, describe, expect, it } from "vitest";
import type { createDocument } from "zod-openapi";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;

describe("GET /api/openapi.json", () => {
  let body: ReturnType<typeof createDocument>;

  beforeAll(async () => {
    const response = await fetch(`${BASE}/api/openapi.json`);
    expect(response.status).toBe(200);
    body = await response.json();
  });

  it("should return 200 with a valid OpenAPI 3.1 document", async () => {
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("cite.me.in Monitoring API");
    expect(body.paths).toHaveProperty("/api/site/{domain}");
    expect(body.paths).toHaveProperty("/api/site/{domain}/metrics");
    expect(body.paths).toHaveProperty("/api/site/{domain}/queries");
  });

  it("should document BearerAuth security scheme", async () => {
    invariant(
      body.components?.securitySchemes,
      "Security schemes are required",
    );
    expect(body.components.securitySchemes.BearerAuth).toBeDefined();
    invariant(
      "scheme" in body.components.securitySchemes.BearerAuth,
      "BearerAuth scheme is required",
    );
    expect(body.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });
});
