import { beforeAll, describe, expect, it } from "vitest";
import { accessToken, mcpRequest, parseResponse } from "./setup";

describe("initialization", () => {
  let response: Response;
  let body: {
    result: { protocolVersion: string; serverInfo: { name: string } };
  };

  beforeAll(async () => {
    response = await mcpRequest({
      accessToken,
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      },
    });
    body = parseResponse(await response.text()) as typeof body;
  });

  it("should return 200", async () => {
    expect(response.status).toBe(200);
  });

  it("should return the protocol version and server info", async () => {
    expect(body.result.protocolVersion).toBe("2024-11-05");
    expect(body.result.serverInfo.name).toBe("cite.me.in");
  });
});
