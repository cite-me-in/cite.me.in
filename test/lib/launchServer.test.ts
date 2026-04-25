import net from "node:net";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  closeServer,
  getServerBaseURL,
  getServerPort,
  isPortAvailable,
} from "~/test/helpers/launchServer";

const servers: net.Server[] = [];
const originalTestBaseUrl = process.env.TEST_BASE_URL;
const originalTestPort = process.env.TEST_PORT;

async function listen(host: string): Promise<number> {
  const server = net.createServer();
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error(`Expected ${host} listener to have an address`);
  }

  return address.port;
}

afterEach(async () => {
  if (originalTestBaseUrl === undefined) delete process.env.TEST_BASE_URL;
  else process.env.TEST_BASE_URL = originalTestBaseUrl;
  if (originalTestPort === undefined) delete process.env.TEST_PORT;
  else process.env.TEST_PORT = originalTestPort;

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("isPortAvailable", () => {
  it("should return false when a port is occupied on IPv4 loopback", async () => {
    const port = await listen("127.0.0.1");

    await expect(isPortAvailable(port)).resolves.toBe(false);
  });

  it("should return false when a port is occupied on IPv6 loopback", async () => {
    const port = await listen("::1");

    await expect(isPortAvailable(port)).resolves.toBe(false);
  });
});

describe("getServerBaseURL", () => {
  it("should use the selected test server port", () => {
    delete process.env.TEST_BASE_URL;
    process.env.TEST_PORT = "12345";

    expect(getServerPort()).toBe(12345);
    expect(getServerBaseURL()).toBe("http://localhost:12345");
  });
});

describe("closeServer", () => {
  it("should release the launched server port from persisted state", async () => {
    const serverPort = getServerPort();
    delete process.env.TEST_SERVER_PID;

    await closeServer();

    await expect(isPortAvailable(serverPort)).resolves.toBe(true);
  });
});
