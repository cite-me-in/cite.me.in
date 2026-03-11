import { CSPProvider } from "@base-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import PageLoadingBouncer from "~/components/ui/PageLoadingBouncer";
import "~/global.css";
import envVars from "~/lib/envVars";
import { useGoogleAnalytics } from "~/lib/useAnalytics";
import PageFooter from "./PageFooter";
import PageHeader from "./PageHeader";

const title = "Cite.me.in — Monitor AI citation visibility";
const url = "https://cite.me.in/";

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
        <meta name="author" content="Cite.me.in" />
        <meta name="theme-color" content="#2563eb" />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        {/* Touch web app title */}
        <meta name="application-name" content="Cite.me.in" />
        <meta name="apple-mobile-web-app-title" content="Cite.me.in" />
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
            <CSPProvider disableStyleElements>
              {/* @see https://base-ui.com/react/overview/quick-start */}
              <div className="relative isolate flex min-h-screen flex-col">
                <PageHeader />
                {children}
                <PageFooter />
              </div>
            </CSPProvider>
          )}
        </QueryClientProvider>
        <DevTag />
        <PageLoadingBouncer />
        <ScrollRestoration />
        <Scripts />
        {import.meta.env.PROD && <Analytics />}
        {import.meta.env.PROD && <SpeedInsights />}
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
      name: "Cite.me.in",
      description: "Monitor AI citation visibility for your brand.",
      email: envVars.EMAIL_FROM.replace("noreply@", "hello@"),
      url: envVars.APP_URL,
      logo: `${envVars.APP_URL}/icon-192.png`,
      image: `${envVars.APP_URL}/images/og-image.png`,
      contactPoint: {
        "@type": "ContactPoint",
        email: envVars.EMAIL_FROM.replace("noreply@", "hello@"),
        contactType: "Customer Service",
      },
      slogan: "Monitor AI citation visibility for your brand.",
    },
    {
      "@id": envVars.APP_URL,
      "@type": "WebSite",
      name: "Cite.me.in",
      description: "Monitor AI citation visibility for your brand.",
      inLanguage: "en",
      url: envVars.APP_URL,
      keywords:
        "AI citation visibility, AI citation monitoring, AI citation tracking, AI citation analysis, AI citation optimization, AI citation improvement",
    },
    {
      "@id": `${envVars.APP_URL}/images/og-image.png`,
      "@type": "ImageObject",
      name: "OG Image",
      caption: "Monitor AI citation visibility for your brand.",
      contentUrl: `${envVars.APP_URL}/images/og-image.png`,
      url: `${envVars.APP_URL}/images/og-image.png`,
      height: 1024,
      width: 1024,
    },
  ],
};
