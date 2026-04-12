import { describe, expect, it } from "vitest";
import parseHTMLTree, {
  getMainContent,
  htmlToMarkdown,
} from "~/lib/html/parseHTML";

describe("getMainContent", () => {
  it("should prefer <main> over <body>", () => {
    const tree = parseHTMLTree(
      "<body><nav>nav</nav><main><p>content</p></main></body>",
    );
    const content = getMainContent(tree);
    expect(htmlToMarkdown(content)).toContain("content");
    expect(htmlToMarkdown(content)).not.toContain("nav");
  });

  it("should fall back to <article> when no <main>", () => {
    const tree = parseHTMLTree(
      "<body><article><p>article content</p></article></body>",
    );
    const content = getMainContent(tree);
    expect(htmlToMarkdown(content)).toContain("article content");
  });

  it("should fall back to [role=main]", () => {
    const tree = parseHTMLTree(
      '<body><div role="main"><p>role content</p></div></body>',
    );
    const content = getMainContent(tree);
    expect(htmlToMarkdown(content)).toContain("role content");
  });

  it("should fall back to <body> when no semantic element", () => {
    const tree = parseHTMLTree("<body><p>body content</p></body>");
    const content = getMainContent(tree);
    expect(htmlToMarkdown(content)).toContain("body content");
  });

  it("should strip nav/header/footer/aside/form noise", () => {
    const tree = parseHTMLTree(
      "<body><header>hdr</header><p>body</p><footer>ftr</footer><aside>side</aside></body>",
    );
    const content = getMainContent(tree);
    const md = htmlToMarkdown(content);
    expect(md).toContain("body");
    expect(md).not.toContain("hdr");
    expect(md).not.toContain("ftr");
    expect(md).not.toContain("side");
  });
});

describe("htmlToMarkdown", () => {
  it("should render headings with # prefix", () => {
    const tree = parseHTMLTree("<h1>Title</h1><h2>Sub</h2>");
    expect(htmlToMarkdown(tree)).toBe("# Title\n\n## Sub\n\n");
  });

  it("should render paragraphs with double newlines", () => {
    const tree = parseHTMLTree("<p>First</p><p>Second</p>");
    expect(htmlToMarkdown(tree)).toBe("First\n\nSecond\n\n");
  });

  it("should render block elements with newlines", () => {
    const tree = parseHTMLTree("<div>First</div><div>Second</div>");
    expect(htmlToMarkdown(tree)).toBe("First\nSecond\n");
  });

  it("should render bold and italic inline", () => {
    const tree = parseHTMLTree(
      "<p><strong>bold</strong> and <em>italic</em></p>",
    );
    expect(htmlToMarkdown(tree)).toContain("**bold**");
    expect(htmlToMarkdown(tree)).toContain("*italic*");
  });

  it("should add space around bold text", () => {
    const tree = parseHTMLTree("<p>before<strong>bold</strong>after</p>");
    const md = htmlToMarkdown(tree);
    expect(md).toContain("before **bold** after");
  });

  it("should render code with backticks", () => {
    const tree = parseHTMLTree(
      "<p>use <code>npm install</code> to install</p>",
    );
    expect(htmlToMarkdown(tree)).toContain("`npm install`");
  });

  it("should render tt with backticks", () => {
    const tree = parseHTMLTree("<p>press <tt>Enter</tt> to continue</p>");
    expect(htmlToMarkdown(tree)).toContain("`Enter`");
  });

  it("should render pre with triple backticks", () => {
    const tree = parseHTMLTree("<pre>const x = 1;</pre>");
    expect(htmlToMarkdown(tree)).toContain("```\nconst x = 1;\n```");
  });

  it("should render list items with - prefix", () => {
    const tree = parseHTMLTree("<ul><li>one</li><li>two</li></ul>");
    expect(htmlToMarkdown(tree)).toContain("- one\n");
    expect(htmlToMarkdown(tree)).toContain("- two\n");
  });

  it("should render anchor text without href", () => {
    const tree = parseHTMLTree('<a href="https://example.com">click here</a>');
    expect(htmlToMarkdown(tree)).toBe("click here");
  });

  it("should strip script and style tags", () => {
    const tree = parseHTMLTree("<p>text</p><style>.x{color:red}</style>");
    expect(htmlToMarkdown(tree)).not.toContain(".x");
    expect(htmlToMarkdown(tree)).toContain("text");
  });

  it("should render hr as ---", () => {
    const tree = parseHTMLTree("<p>before</p><hr/><p>after</p>");
    expect(htmlToMarkdown(tree)).toContain("---\n\n");
  });

  it("should render br as newline", () => {
    const tree = parseHTMLTree("<p>line1<br/>line2</p>");
    expect(htmlToMarkdown(tree)).toContain("line1\nline2");
  });

  it("should add space between inline elements", () => {
    const tree = parseHTMLTree(
      "<span>Home</span><span>Pricing</span><span>Manifesto</span><span>Blog</span>",
    );
    expect(htmlToMarkdown(tree)).toBe("Home Pricing Manifesto Blog");
  });

  it("should not add space between block elements", () => {
    const tree = parseHTMLTree("<div>one</div><div>two</div>");
    expect(htmlToMarkdown(tree)).toBe("one\ntwo\n");
  });

  it("should decode HTML entities", () => {
    const tree = parseHTMLTree("<p>Tom &amp; Jerry</p>");
    expect(htmlToMarkdown(tree).trim()).toEqual("Tom & Jerry");
  });

  it("should decode &mdash; entity", () => {
    const tree = parseHTMLTree("<p>2020&mdash;2024</p>");
    expect(htmlToMarkdown(tree).trim()).toEqual("2020—2024");
  });

  it("should decode numeric entities like &#39;", () => {
    const tree = parseHTMLTree("<p>It&#39;s working</p>");
    expect(htmlToMarkdown(tree).trim()).toEqual("It's working");
  });

  it("should decode hex entities like &#x27;", () => {
    const tree = parseHTMLTree("<p>It&#x27;s working</p>");
    expect(htmlToMarkdown(tree).trim()).toEqual("It's working");
  });
});
