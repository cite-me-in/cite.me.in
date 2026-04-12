import type { HTMLNode } from "./HTMLNode";

const emptyAttributes = [
  // Form elements
  "disabled",
  "checked",
  "selected",
  "required",
  "readonly",
  "multiple",
  "autofocus", // on <input>, <textarea>, <select>
  "novalidate", // on <form>
  "formnovalidate", // on <form>

  // Media / resources
  "autoplay", // on <audio>, <video>
  "controls", // on <audio>, <video>
  "loop", // on <audio>, <video>
  "muted", // on <audio>, <video>
  "default", // on <track>
  "async", // on <script>
  "defer",

  // Content / behavior
  "hidden",
  "open", // on <details>, <dialog>
  "ismap", // on <img>
  "reversed", // on <ol>
  "allowfullscreen", // on <iframe>
  "playsinline", // on <video>

  // Less common attributes
  "inert",
  "itemscope",
];

const blockElements = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "div",
  "pre",
  "ol",
  "ul",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "tr",
  "td",
  "th",
];

const inlineElements = new Set([
  "span",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "code",
  "tt",
  "abbr",
  "cite",
  "mark",
  "small",
  "sub",
  "sup",
  "time",
  "u",
]);

const NOISE_TAGS = new Set(["nav", "header", "footer", "aside", "form"]);

/**
 * Parses an HTML string into a tree of elements and text nodes.  The HTML is
 * assumed to be valid, well-formed HTML (i.e., as returned by innerHTML).
 *
 * @param html - The HTML to parse.
 * @returns The parsed HTML as a tree of elements and text nodes. The HTML is
 * sorted by attributes to make the diffs easier to read.
 */
export default function parseHTMLTree(html: string): HTMLNode[] {
  // An improved, more memory-efficient HTML parser that avoids repeated RegExp.exec (which can leak memory
  // on large input due to its lastIndex statefulness, especially in poorly structured document).
  // This avoids recursion and big intermediate arrays as much as possible.

  // Utility to parse attributes string into a Record
  function parseAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /\s*([a-zA-Z0-9-:]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
    let match: RegExpExecArray | null;
    for (;;) {
      match = attrRegex.exec(attrStr);
      if (match === null) break;
      const [, name, doubleVal, singleVal] = match;
      const value = doubleVal ?? singleVal;
      if (value !== undefined && value !== "") attrs[name] = value;
      else if (emptyAttributes.includes(name)) attrs[name] = "";
    }
    return attrs;
  }

  // Remove scripts and comments, so they're not parsed as nodes.
  const raw = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const tagRegex =
    /<(\/?)([a-zA-Z0-9-]+)((?:\s+[a-zA-Z0-9-:]+(?:=(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;

  const stack: HTMLNode[] = [];
  const root: HTMLNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Stream through the HTML string without the repeated exec in inner loop:
  // Refactored per lint rule: do not assign in while condition
  while (true) {
    match = tagRegex.exec(raw);
    if (match === null) break;
    const [full, slash, tagName, attrStr, selfClosing] = match;
    // Text node before this tag
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (trimmed) {
        const node: HTMLNode = { type: "text", content: trimmed };
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          if (
            parent &&
            parent.type === "element" &&
            Array.isArray(parent.children)
          ) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      }
    }

    if (slash) {
      // Closing tag: pop from stack
      const popped = stack.pop();
      // Defensive: If there is an unmatched closing tag, just skip
      if (popped) {
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          if (
            parent &&
            parent.type === "element" &&
            Array.isArray(parent.children)
          ) {
            parent.children.push(popped);
          }
        } else {
          root.push(popped);
        }
      }
    } else {
      // Opening or self-closing tag
      const node: HTMLNode = {
        type: "element",
        tag: tagName.toLowerCase(),
        attributes: parseAttributes(attrStr),
        children: [],
      };
      if (selfClosing || isSelfClosingTagString(full)) {
        // Self-closing tag: push to children or root
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          if (
            parent &&
            parent.type === "element" &&
            Array.isArray(parent.children)
          ) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      } else {
        // Opening tag: push to stack
        stack.push(node);
      }
    }
    lastIndex = tagRegex.lastIndex;
  }

  // Text node after last tag
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed) {
      const node: HTMLNode = { type: "text", content: trimmed };
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        if (
          parent &&
          parent.type === "element" &&
          Array.isArray(parent.children)
        ) {
          parent.children.push(node);
        }
      } else {
        root.push(node);
      }
    }
  }

  // Any not-properly-closed elements left: push them to root in order
  while (stack.length > 0) {
    const popped = stack.pop();
    if (popped) {
      if (stack.length > 0) {
        // Fix: push to the correct parent's children array with type safety
        const parent = stack[stack.length - 1];
        if (
          parent &&
          parent.type === "element" &&
          Array.isArray(parent.children)
        ) {
          parent.children.push(popped);
        }
      } else {
        root.push(popped);
      }
    }
  }

  return root;
}

function isSelfClosingTagString(tag: string): boolean {
  return (
    /\/>$/.test(tag) ||
    /<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)[\s/>]/i.test(
      tag,
    )
  );
}

export function getBodyContent(html: HTMLNode[]): string {
  const body = getElementsByTagName(html, "body");
  removeElements(
    body,
    (node) =>
      (node.type === "element" && node.tag === "script") ||
      (node.type === "element" && node.tag === "style"),
  );
  return getTextContent(body);
}

/**
 * Queries the HTML tree for elements with the given tag name. The elements are
 * returned with the type "element" to make it easier to use with the other
 * functions in this module.
 *
 * @param html - The HTML tree to query.
 * @param tagName - The tag name to query the HTML tree with.
 * @returns The elements with the given tag name.
 */
export function getElementsByTagName(
  html: HTMLNode[],
  tagName: string,
): (HTMLNode & { type: "element" })[] {
  const result: (HTMLNode & { type: "element" })[] = [];
  for (const node of html) {
    if (node.type === "element") {
      if (node.tag.toLowerCase() === tagName.toLowerCase())
        result.push({ ...node, type: "element" });
      result.push(...getElementsByTagName(node.children, tagName));
    }
  }
  return result;
}

/**
 * Recursively iterates the tree and removes the elements that match the given function.  The elements
 * are removed by reference, so the original tree is modified.
 *
 * @param html - The HTML tree to remove the elements from.
 * @param match - The function to match the elements to remove.
 * @example
 * removeElements(html, (node) => node.tag === "script"); // removes all <script> elements
 */
export function removeElements(
  html: HTMLNode[],
  match: (node: HTMLNode & { type: "element" }) => boolean,
): void {
  for (let i = html.length - 1; i >= 0; i--) {
    const node = html[i];
    if (node.type === "element" && match(node)) html.splice(i, 1);
    else if (node.type === "element" && node.children)
      removeElements(node.children, match);
  }
}

/**
 * Recursively iterates the tree and finds the elements that match the given function.  The elements
 * are found by reference, so the original tree is not modified.
 *
 * @param html - The HTML tree to find the elements in.
 * @param match - The function to match the elements to find.
 * @param modify - The function to modify the elements that match the given function.
 */
export function modifyElements(
  html: HTMLNode[],
  match: (node: HTMLNode & { type: "element" }) => boolean,
  modify: (
    node: HTMLNode & { type: "element" },
  ) => HTMLNode & { type: "element" },
): void {
  for (let i = html.length - 1; i >= 0; i--) {
    const node = html[i];
    if (node.type === "element" && match(node)) html[i] = modify(node);
    else if (node.type === "element" && node.children)
      modifyElements(node.children, match, modify);
  }
}

/**
 * Gets the text content of the HTML tree. The text content is the text of the
 * text nodes in the tree. The text content is not the text of the elements,
 * but the text of the text nodes.
 *
 * @param html - The HTML tree to get the text content of.
 * @returns The text content of the HTML tree.
 */
export function getTextContent(html: HTMLNode[]): string {
  return html
    .map((node) =>
      node.type === "text"
        ? decodeHTMLEntities(node.content)
        : node.tag === "br"
          ? "\n"
          : blockElements.includes(node.tag)
            ? `${getTextContent(node.children)}\n`
            : getTextContent(node.children),
    )
    .join(" ");
}

export function getMainContent(tree: HTMLNode[]): HTMLNode[] {
  // Strip noisy elements first (mutates a copy at top level)
  const filtered = tree.filter(
    (n) => !(n.type === "element" && NOISE_TAGS.has(n.tag)),
  );
  for (const node of filtered) {
    if (node.type === "element")
      removeElements(node.children, (n) => NOISE_TAGS.has(n.tag));
  }

  // Priority: <main> → <article> → [role="main"] → <body>
  const main = getElementsByTagName(filtered, "main");
  if (main.length > 0) return main[0].children;

  const article = getElementsByTagName(filtered, "article");
  if (article.length > 0) return article[0].children;

  const roleMain = findByAttribute(filtered, "role", "main");
  if (roleMain) return roleMain.children;

  const body = getElementsByTagName(filtered, "body");
  if (body.length > 0) return body[0].children;

  return filtered;
}

function findByAttribute(
  nodes: HTMLNode[],
  attr: string,
  value: string,
): (HTMLNode & { type: "element" }) | null {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.attributes[attr] === value) return node;
    const found = findByAttribute(node.children, attr, value);
    if (found) return found;
  }
  return null;
}

export function htmlToMarkdown(nodes: HTMLNode[]): string {
  const parts = nodes.map((node) => nodeToMarkdown(node));
  return parts
    .map((part, i) => {
      if (i === 0) return part;
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const prevIsText = prev.type === "text";
      const currIsText = curr.type === "text";
      const prevIsInline =
        prev.type === "element" && inlineElements.has(prev.tag);
      const currIsInline =
        curr.type === "element" && inlineElements.has(curr.tag);
      if ((prevIsText && currIsInline) || (prevIsInline && currIsText)) {
        return ` ${part}`;
      }
      if (prevIsInline && currIsInline) {
        return ` ${part}`;
      }
      return part;
    })
    .join("");
}

function nodeToMarkdown(node: HTMLNode): string {
  if (node.type === "text") return decodeHTMLEntities(node.content);

  const { tag, children } = node;
  const inner = () => htmlToMarkdown(children);

  switch (tag) {
    case "h1":
      return `# ${inner()}\n\n`;
    case "h2":
      return `## ${inner()}\n\n`;
    case "h3":
      return `### ${inner()}\n\n`;
    case "h4":
      return `#### ${inner()}\n\n`;
    case "h5":
      return `##### ${inner()}\n\n`;
    case "h6":
      return `###### ${inner()}\n\n`;
    case "p":
      return `${inner()}\n\n`;
    case "br":
      return "\n";
    case "hr":
      return "---\n\n";
    case "strong":
    case "b":
      return `**${inner()}**`;
    case "em":
    case "i":
      return `*${inner()}*`;
    case "code":
    case "tt":
      return `\`${inner()}\``;
    case "li":
      return `- ${inner()}\n`;
    case "ul":
    case "ol":
      return `${inner()}\n`;
    case "a":
      return inner();
    case "script":
    case "style":
    case "noscript":
      return "";
    case "div":
    case "section":
    case "blockquote":
      return `${inner()}\n`;
    case "pre": {
      const preContent = inner().trimEnd();
      return `\`\`\`\n${preContent}\n\`\`\`\n`;
    }
    default:
      return inner();
  }
}

function decodeHTMLEntities(content: string): string {
  return content
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&euro;/g, "€")
    .replace(/&pound;/g, "£")
    .replace(/&yen;/g, "¥")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\\&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\&#([0-9]+);/g, (_, dec) =>
      String.fromCharCode(Number.parseInt(dec, 10)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCharCode(Number.parseInt(dec, 10)),
    );
}
