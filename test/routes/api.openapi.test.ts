import { describe, expect, it } from "vitest";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;

describe("GET /api/openapi.json", () => {
  it("returns 200 with a valid OpenAPI 3.1 document", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Cite.me.in Monitoring API");
    expect(body.paths).toHaveProperty("/api/sites/{domain}");
    expect(body.paths).toHaveProperty("/api/sites/{domain}/runs");
    expect(body.paths).toHaveProperty("/api/sites/{domain}/runs/{runId}");
  });

  it("documents BearerAuth security scheme", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const body = await res.json();
    expect(body.components.securitySchemes.BearerAuth).toBeDefined();
    expect(body.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });
});
