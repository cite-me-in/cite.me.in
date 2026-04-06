import { useEffect } from "react";
import {
  type HeadersFunction,
  Outlet,
  isRouteErrorResponse,
} from "react-router";
import { WaveLoading } from "respinner";
import { requireUserAccess } from "~/lib/auth.server";
import type { Route } from "./+types/root";
import PageLayout from "./components/layout/PageLayout";
import Main from "./components/ui/Main";
import "./global.css";
import socialLinks from "./lib/socialLinks";
import { trackVisits } from "./lib/trackVisits.server";

export async function loader({ request }: Route.LoaderArgs) {
  trackVisits(request);
  const baseUrl = new URL(request.url).origin;
  try {
    const { user, ownedSites, siteUsers } = await requireUserAccess(request);
    const isPro = user.plan === "paid" || user.plan === "gratis";
    const sites = [...ownedSites, ...siteUsers.map(({ site }) => site)];
    return { user, baseUrl, sites, isPro };
  } catch {
    return { user: null, baseUrl, sites: [], isPro: false };
  }
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const ogImage = loaderData
    ? `${loaderData.baseUrl}/og-image.png`
    : "/og-image.png";
  return [
    { title: "Cite.me.in — Monitor LLM citation visibility" },
    {
      name: "description",
      content: "Monitor LLM citation visibility for your brand.",
    },
    { property: "og:title", content: "Cite.me.in" },
    {
      property: "og:description",
      content: "Monitor LLM citation visibility for your brand.",
    },
    { property: "og:image", content: ogImage },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Cite.me.in" },
    {
      name: "twitter:description",
      content: "Monitor LLM citation visibility for your brand.",
    },
    { name: "twitter:image", content: ogImage },
    { name: "robots", content: "index, follow" },
  ];
}

export const headers: HeadersFunction = () => ({
  "Document-Policy": "js-profiling",
});

export const links: Route.LinksFunction = () => [
  {
    rel: "alternate",
    type: "application/atom+xml",
    title: "The Cite.me.in Blog",
    href: new URL("/rss.xml", import.meta.env.VITE_APP_URL).toString(),
  },
  {
    rel: "sitemap",
    type: "application/xml",
    href: new URL("/sitemap.xml", import.meta.env.VITE_APP_URL).toString(),
  },
  { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
  { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  ...socialLinks.map(({ url }) => ({ rel: "me", href: url })),
];

export function Layout({ children }: { children: React.ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}

export default function App() {
  useEffect(() => {
    document.body.setAttribute("data-hydrated", "true");
  }, []);
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Main variant="prose">
      <h1 className="mx-auto flex flex-row justify-center gap-2 text-4xl">
        <span className="font-bold text-red-500">{message}</span>
        <span className="text-gray-500">{details}</span>
      </h1>
      {import.meta.env.MODE === "development" && stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </Main>
  );
}

export function HydrateFallback() {
  return (
    <Layout>
      <Main
        variant="prose"
        className="flex flex-col items-center justify-center gap-4"
      >
        <WaveLoading color="#111111" count={2} />
        <p className="text-gray-500 text-lg">Loading, please wait...</p>
      </Main>
    </Layout>
  );
}
