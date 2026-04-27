type Tier = {
  key: "critical" | "important" | "optimization";
  title: string;
  color: string;
  emailColor: string;
  description: string;
  checks: { name: string; desc: string }[];
};

const TIERS: Tier[] = [
  {
    key: "critical",
    title: "Critical — Gates AI Discovery",
    color: "text-red-600",
    emailColor: "#dc2626",
    description: "Can AI agents reach and read my content?",
    checks: [
      {
        name: "robots.txt",
        desc: "Controls whether AI crawlers are allowed on your site",
      },
      {
        name: "sitemap.xml",
        desc: "The canonical sitemap format most crawlers use",
      },
      {
        name: "Homepage content",
        desc: "Homepage returns real content, not an empty SPA shell",
      },
    ],
  },
  {
    key: "important",
    title: "Important — Improves Discovery Quality",
    color: "text-yellow-600",
    emailColor: "#ca8a04",
    description:
      "Can AI agents find all my content and understand what it's about?",
    checks: [
      {
        name: "llms.txt",
        desc: "Direct signal to LLMs about what content to index",
      },
      { name: "sitemap.txt", desc: "Plain-text supplement to XML sitemaps" },
      {
        name: "Sample pages",
        desc: "Pages in your sitemap return real content",
      },
      { name: "Meta tags", desc: "Title and description for summaries" },
    ],
  },
  {
    key: "optimization",
    title: "Optimization — Enhances Presentation",
    color: "text-green-600",
    emailColor: "#16a34a",
    description: "Does my content present well when cited?",
    checks: [
      { name: "JSON-LD", desc: "Structured data for entity understanding" },
      {
        name: "Open Graph tags",
        desc: "Social preview and citation formatting",
      },
      { name: "Canonical URLs", desc: "Prevents duplicate content confusion" },
    ],
  },
];
export default TIERS;
