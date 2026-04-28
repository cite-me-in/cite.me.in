type Category = {
  key: "discovered" | "trusted" | "welcomed";
  title: string;
  color: string;
  gaugeColor: string;
  emailColor: string;
  description: string;
  checks: { name: string; desc: string }[];
};

const CATEGORIES: Category[] = [
  {
    key: "discovered",
    title: "Discovered",
    color: "text-blue-600",
    gaugeColor: "#3b82f6",
    emailColor: "#2563eb",
    description: "Can AI agents find all my content?",
    checks: [
      {
        name: "sitemap.xml",
        desc: "The canonical sitemap format most crawlers use",
      },
      {
        name: "sitemap.txt",
        desc: "Plain-text supplement to XML sitemaps",
      },
      {
        name: "llms.txt",
        desc: "Direct signal to LLMs about what content to index",
      },
    ],
  },
  {
    key: "trusted",
    title: "Trusted",
    color: "text-purple-600",
    gaugeColor: "#9333ea",
    emailColor: "#9333ea",
    description: "Does my content present well when cited?",
    checks: [
      {
        name: "Homepage content",
        desc: "Homepage returns real content, not an empty SPA shell",
      },
      {
        name: "Sample pages",
        desc: "Pages in your sitemap return real content",
      },
      {
        name: "Meta tags",
        desc: "Title and description for summaries",
      },
      {
        name: "JSON-LD",
        desc: "Structured data for entity understanding",
      },
    ],
  },
  {
    key: "welcomed",
    title: "Welcomed",
    color: "text-emerald-600",
    gaugeColor: "#059669",
    emailColor: "#059669",
    description: "Are AI crawlers allowed on my site?",
    checks: [
      {
        name: "robots.txt",
        desc: "Controls whether AI crawlers are allowed on your site",
      },
    ],
  },
];

export default CATEGORIES;
