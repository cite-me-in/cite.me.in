import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import PageLoadingBouncer from "~/components/ui/PageLoadingBouncer";
import "~/global.css";
import { useGoogleAnalytics } from "~/lib/useAnalytics";
import PageFooter from "./PageFooter";
import PageHeader from "./PageHeader";

const title = "CiteUp — Monitor AI citation visibility";
const url = "https://citeup.com/";

export type HeaderLink = {
  label: string;
  to: string;
};

export default function PageLayout({
  children,
  hideLayout = false,
}: {
  children: React.ReactNode;
  hideLayout?: boolean;
}) {
  useGoogleAnalytics();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="CiteUp" />
        <meta name="theme-color" content="#2563eb" />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        {/* Touch web app title */}
        <meta name="application-name" content="CiteUp" />
        <meta name="apple-mobile-web-app-title" content="CiteUp" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Google / Search Engine Tags */}
        <meta itemProp="image" content={`${url}/images/og-image.png`} />
        <meta itemProp="name" content={title} />

        {/* https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Client_hints */}
        <meta httpEquiv="Accept-CH" content="Width, Downlink, Sec-CH-UA" />

        <Meta />
        <Links />
      </head>
      <body className="relative">
        <QueryClientProvider client={new QueryClient()}>
          {hideLayout ? (
            children
          ) : (
            <div className="isolate flex min-h-screen flex-col">
              <PageHeader />
              {children}
              <PageFooter />
            </div>
          )}
        </QueryClientProvider>
        <DevTag />
        <PageLoadingBouncer />
        <ScrollRestoration />
        <Scripts />
        <Analytics />
        <SpeedInsights />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </body>
    </html>
  );
}

function DevTag() {
  return (
    !import.meta.env.PROD &&
    !import.meta.env.VITE_TEST_MODE && (
      <span className="fixed top-4 left-4 z-1000 rounded-full bg-red-400 px-4 py-2 font-bold text-white shadow-lg">
        DEV
      </span>
    )
  );
}

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "CiteUp",
      description: "Monitor AI citation visibility for your brand.",
      email: "hello@citeup.com",
      url: "https://citeup.com",
      logo: "https://citeup.com/icon-192.png",
      image: "https://citeup.com/images/og-image.png",
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@citeup.com",
        contactType: "Customer Service",
      },
      slogan: "Monitor AI citation visibility for your brand.",
    },
    {
      "@id": "https://citeup.com",
      "@type": "WebSite",
      name: "CiteUp",
      description: "Monitor AI citation visibility for your brand.",
      inLanguage: "en",
      url: "https://citeup.com",
      keywords:
        "AI citation visibility, AI citation monitoring, AI citation tracking, AI citation analysis, AI citation optimization, AI citation improvement",
    },
    {
      "@id": "https://citeup.com/images/og-image.png",
      "@type": "ImageObject",
      name: "OG Image",
      caption: "Monitor AI citation visibility for your brand.",
      contentUrl: "https://citeup.com/images/og-image.png",
      url: "https://citeup.com/images/og-image.png",
      height: 1024,
      width: 1024,
    },
  ],
};
