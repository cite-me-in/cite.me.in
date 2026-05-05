import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vite-plus/test";
import { markdownMiddleware } from "~/middleware/markdown";

vi.mock("defuddle/node", () => ({
  Defuddle: vi
    .fn<() => { contentMarkdown: string; content: string }>()
    .mockResolvedValue({
      contentMarkdown:
        "# Test\n\nMarkdown content here that is long enough to pass validation.",
      content:
        "<h1>Test</h1><p>Markdown content here that is long enough to pass validation.</p>",
    }),
}));

vi.mock("linkedom", () => ({
  parseHTML: vi.fn<() => { document: {} }>().mockReturnValue({ document: {} }),
}));

describe("markdownMiddleware", () => {
  let mockNext: Mock<() => Promise<Response>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNext = vi.fn<() => Promise<Response>>();
  });

  it("should return markdown for .md requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<html><head><title>Test</title></head><body>Content</body></html>",
        {
          headers: { "Content-Type": "text/html" },
        },
      ),
    );

    const request = new Request("http://localhost:5173/privacy.md");
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 404 for .md requests when HTML contains 404 title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<html><head><title>404</title></head><body></body></html>",
        {
          status: 200,
        },
      ),
    );

    const request = new Request("http://localhost:5173/missing.md");
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("should return the original status for .md requests when fetch is not OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Server Error", { status: 500 }),
    );

    const request = new Request("http://localhost:5173/error.md");
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response.status).toBe(500);
  });

  it("should convert HTML to markdown when Accept header includes text/markdown", async () => {
    mockNext.mockResolvedValue(
      new Response(
        "<html><head><title>Test</title></head><body>Content</body></html>",
        {
          headers: { "Content-Type": "text/html" },
        },
      ),
    );

    const request = new Request("http://localhost:5173/page", {
      headers: { Accept: "text/markdown" },
    });
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it("should pass through non-HTML responses when Accept header includes text/markdown", async () => {
    const jsonResponse = new Response(JSON.stringify({ data: "test" }), {
      headers: { "Content-Type": "application/json" },
    });
    mockNext.mockResolvedValue(jsonResponse);

    const request = new Request("http://localhost:5173/api/data", {
      headers: { Accept: "text/markdown" },
    });
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response).toBe(jsonResponse);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should call next() when no .md extension and no Accept header", async () => {
    const expectedResponse = new Response("Hello", { status: 200 });
    mockNext.mockResolvedValue(expectedResponse);

    const request = new Request("http://localhost:5173/page");
    const response = await markdownMiddleware({ request }, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(response).toBe(expectedResponse);
  });

  it("should return 404 when Defuddle returns empty markdown content", async () => {
    const { Defuddle } = await import("defuddle/node");
    vi.mocked(Defuddle).mockResolvedValueOnce({
      contentMarkdown: "",
      content: "",
      title: "",
      description: "",
      domain: "",
      favicon: "",
      image: "",
      language: "",
      parseTime: 0,
      published: "",
      author: "",
      site: "",
      schemaOrgData: undefined,
      wordCount: 0,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body></body></html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );

    const request = new Request("http://localhost:5173/empty.md");
    const response = await markdownMiddleware({ request }, mockNext);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });
});
