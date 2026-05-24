import prices from "~/data/stripe-prices.json";

const siteURL = import.meta.env.VITE_APP_URL as string;
const siteEmail = import.meta.env.VITE_EMAIL_FROM as string;

export default function PageSchema() {
  return (
    <script type="application/ld+json">
      {JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            name: "Cite.me.in",
            description: "Monitor whether your brand gets cited when people ask AI questions.",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: siteURL,
            offers: {
              "@type": "Offer",
              price: prices.monthlyAmount,
              priceCurrency: "USD",
            },
          },
          {
            "@type": "Organization",
            name: "Cite.me.in",
            description: "Monitor AI citation visibility for your brand.",
            email: siteEmail,
            url: siteURL,
            logo: new URL("/icon-192.png", siteURL).toString(),
            image: new URL("/images/og-image.png", siteURL).toString(),
            contactPoint: {
              "@type": "ContactPoint",
              email: siteEmail,
              contactType: "Customer Service",
            },
            slogan: "Monitor AI citation visibility for your brand.",
          },
          {
            "@id": siteURL,
            "@type": "WebSite",
            name: "Cite.me.in",
            description: "Monitor AI citation visibility for your brand.",
            inLanguage: "en",
            url: siteURL,
            keywords:
              "AI citation visibility, AI citation monitoring, AI citation tracking, AI citation analysis, AI citation optimization, AI citation improvement",
          },
          {
            "@id": new URL("/images/og-image.png", siteURL).toString(),
            "@type": "ImageObject",
            name: "Cite.me.in OG Image",
            caption: "Monitor AI citation visibility for your brand.",
            contentUrl: new URL("/images/og-image.png", siteURL).toString(),
            height: 1024,
            width: 1024,
          },
          {
            "@type": "FAQPage",
            name: "Cite.me.in FAQ",
            mainEntity: [
              {
                "@type": "Question",
                name: "What is AEO monitoring?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "AEO (Answer Engine Optimization) monitoring tracks whether your brand, product, or website gets cited when people ask AI chatbots questions in your market. Tools like ChatGPT, Claude, and Gemini increasingly answer questions directly — AEO monitoring tells you if you're showing up in those answers.",
                },
              },
              {
                "@type": "Question",
                name: "How do I know if AI mentions my brand?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "cite.me.in runs AI queries on your behalf across ChatGPT, Claude, and Gemini, then checks whether your brand appears in the responses. You get a weekly report showing your citation rate, which queries you appeared in, and how you compare to competitors.",
                },
              },
              {
                "@type": "Question",
                name: "What's the best tool to track AI citations?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `cite.me.in is an AI citation monitoring tool built for founders. It's open-source, starts free for 25 days with no credit card required, and costs $${prices.monthlyAmount}/month on the Pro plan — the lowest price in the category. It monitors your brand across ChatGPT, Claude, and Gemini.`,
                },
              },
              {
                "@type": "Question",
                name: "How much does AEO monitoring cost?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `AEO monitoring tools range from $29 to $400+/month. cite.me.in offers a 25-day free trial with no credit card, then $${prices.monthlyAmount}/month for the Pro plan. It's also open-source and self-hostable for free if you prefer to run your own instance.`,
                },
              },
              {
                "@type": "Question",
                name: "Is cite.me.in open-source?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `Yes. cite.me.in is fully open-source. You can self-host it for free with no limits. The hosted service at cite.me.in costs $${prices.monthlyAmount}/month and handles setup, maintenance, and weekly email reports for you.`,
                },
              },
            ],
          },
        ],
      })}
    </script>
  );
}
