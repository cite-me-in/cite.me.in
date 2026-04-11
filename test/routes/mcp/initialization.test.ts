import { beforeAll, describe, expect, it } from "vitest";
import { accessToken, mcpRequest, parseSSEResponse } from "./setup";

describe("initialization", () => {
  let response: Response;

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
  });

  it("should return 200", async () => {
    expect(response.status).toBe(200);
  });

  it("should return a session ID", async () => {
    expect(response.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("should return the protocol version and server info", async () => {
    const body = parseSSEResponse(await response.text()) as {
      result: { protocolVersion: string; serverInfo: { name: string } };
    };
    expect(body.result.protocolVersion).toBe("2024-11-05");
    expect(body.result.serverInfo.name).toBe("cite.me.in");
  });
});
