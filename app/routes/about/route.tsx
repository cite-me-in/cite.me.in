import type { Route } from "./+types/route";
import AboutCTA from "./AboutCTA";
import AboutHeader from "./AboutHeader";
import AboutStory from "./AboutStory";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "About | Cite.me.in" },
    {
      name: "description",
      content:
        "Cite.me.in monitors LLM citation visibility so brands know exactly when and where AI platforms cite them.",
    },
  ];
}

export default function About() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[hsl(60,100%,99%)]"
      aria-label="About page"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData()) }}
      />

      <div className="container mx-auto my-10 space-y-8 p-5">
        <AboutHeader />
        <AboutStory />
      </div>
      <AboutCTA />
    </main>
  );
}

function schemaData() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Cite.me.in",
    description:
      "Learn about Cite.me.in, the platform that monitors LLM citation visibility for brands and content creators.",
    url: new URL("/about", import.meta.env.VITE_APP_URL).toString(),
    mainEntity: {
      "@type": "Organization",
      "@id": new URL("#organization", import.meta.env.VITE_APP_URL).toString(),
      name: "Cite.me.in",
      description:
        "Platform for monitoring LLM citation visibility across AI platforms",
      url: new URL("/about", import.meta.env.VITE_APP_URL).toString(),
      foundingDate: "2026",
      founder: {
        "@type": "Person",
        name: "Assaf Arkin",
        jobTitle: "CEO",
      },
      email: import.meta.env.VITE_EMAIL_FROM as string,
      sameAs: ["https://github.com/cite-me-in/cite.me.in"],
      knowsAbout: [
        "LLM Citation Visibility",
        "AI Search Optimization",
        "Generative Engine Optimization",
        "Brand Monitoring",
        "AI Platform Analytics",
      ],
    },
  };
}
