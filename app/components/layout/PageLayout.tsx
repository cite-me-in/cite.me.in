import { CSPProvider } from "@base-ui/react";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import PageLoadingBouncer from "~/components/ui/PageLoadingBouncer";
import "~/global.css";
import CommandPalette from "./CommandPalette";
import PageAnalytics from "./PageAnalytics";
import PageFooter from "./PageFooter";
import PageHeader from "./PageHeader";
import PageSchema from "./PageSchema";

const title = "Cite.me.in — Monitor AI citation visibility";

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
        <meta
          itemProp="image"
          content={new URL(
            "/images/og-image.png",
            import.meta.env.VITE_APP_URL,
          ).toString()}
        />
        <meta itemProp="name" content={title} />

        {/* https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Client_hints */}
        <meta httpEquiv="Accept-CH" content="Width, Downlink, Sec-CH-UA" />

        <Meta />
        <Links />
      </head>
      <body className="relative">
        <CommandPalette />
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
        <DevTag />
        <PageLoadingBouncer />
        <ScrollRestoration />
        <Scripts />
        {import.meta.env.PROD && <PageAnalytics />}
        <PageSchema />
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
