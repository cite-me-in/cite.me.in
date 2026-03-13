import {
  BarChart2,
  Globe,
  LineChart,
  MessageSquare,
  Search,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";
import CiteMeInLogo from "~/components/layout/CiteMeInLogo";
import { ActiveLink } from "~/components/ui/ActiveLink";
import BlogPostsGrid from "~/components/ui/BlogPostsGrid";
import Main from "~/components/ui/Main";
import { getCurrentUser } from "~/lib/auth.server";
import { type BlogPost, recentBlogPosts } from "~/lib/blogPosts.server";
import type { Route } from "./+types/route";

export const handle = { hideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  const [user, posts] = await Promise.all([
    getCurrentUser(request),
    recentBlogPosts(),
  ]);
  return { user, posts: posts.slice(0, 3) };
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Cite.me.in — Monitor LLM Citation Visibility" },
    {
      name: "description",
      content:
        "Track when ChatGPT, Claude, Gemini, and Perplexity cite your brand. Cite.me.in is the Search Console for AI platforms.",
    },
  ];
}

export default function HomePage({
  loaderData,
}: {
  loaderData: { user: { id: string } | null; posts: BlogPost[] };
}) {
  const { user, posts } = loaderData;

  return (
    <Main className="w-full bg-[hsl(60,100%,99%)]">
      <LandingNav isSignedIn={!!user} />
      <HeroSection isSignedIn={!!user} />
      <HowItWorksSection />
      <ForWhoSection />
      {posts.length > 0 && <BlogSection posts={posts} />}
    </Main>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

function LandingNav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <nav className="flex items-center justify-between border-black border-b-2 bg-[hsl(60,100%,99%)] px-6 py-3">
      <CiteMeInLogo />
      <div className="flex items-center gap-3">
        {isSignedIn ? (
          <ActiveLink variant="button" to="/sites" size="sm" bg="yellow">
            Dashboard
          </ActiveLink>
        ) : (
          <>
            <ActiveLink variant="button" to="/sign-in" size="sm">
              Sign in
            </ActiveLink>
            <ActiveLink variant="button" to="/sign-up" size="sm" bg="yellow">
              Get started
            </ActiveLink>
          </>
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="border-black border-b-2 bg-[#F59E0B] px-6 py-20 md:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 inline-block rounded-base border-2 border-black bg-white px-4 py-1 font-bold text-base shadow-[2px_2px_0px_0px_black]">
          The Search Console for AI
        </div>
        <h1 className="mb-6 font-bold text-4xl text-black leading-tight md:text-6xl">
          Does ChatGPT mention
          <br />
          your brand?
        </h1>
        <p className="mb-10 max-w-2xl font-medium text-black text-xl leading-relaxed md:text-2xl">
          Cite.me.in runs your queries across ChatGPT, Claude, Gemini, and
          Perplexity and records every time they cite your website. See what's
          working. Fix what's not.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          {isSignedIn ? (
            <ActiveLink variant="button" to="/sites" size="xl">
              Add a site
            </ActiveLink>
          ) : (
            <>
              <ActiveLink variant="button" to="/sign-up" size="xl">
                Start monitoring — free
              </ActiveLink>
              <ActiveLink
                variant="button"
                to="/sign-in"
                size="xl"
                className="bg-white"
              >
                Sign in
              </ActiveLink>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

const STEPS = [
  {
    number: "1",
    title: "Add your website",
    body: "Enter your domain. We read your content and instantly suggest 9 ready-to-run queries — covering discovery, comparison, and direct searches — so you're tracking in under a minute. No setup required.",
    icon: Globe,
  },
  {
    number: "2",
    title: "We run the queries",
    body: "Each week we run your queries across every major AI platform with web search enabled — the same experience your potential customers have.",
    icon: Search,
  },
  {
    number: "3",
    title: "You see the citations",
    body: "Every URL that appears in an AI response gets recorded. You see which platforms cite you, how often, and for which queries.",
    icon: BarChart2,
  },
] as const;

function HowItWorksSection() {
  return (
    <section className="border-black border-b-2 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 font-bold text-3xl text-black md:text-4xl">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ number, title, body, icon: Icon }) => (
            <div
              key={number}
              className="flex flex-col gap-4 rounded-base border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-base border-2 border-black bg-[#F59E0B] font-bold shadow-[2px_2px_0px_0px_black]">
                  {number}
                </div>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xl">{title}</h3>
              <p className="font-medium leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Who it's for
// ---------------------------------------------------------------------------

const PERSONAS = [
  {
    icon: TrendingUp,
    title: "Solo founders",
    body: "You're building an audience and want to know if AI platforms are sending you traffic — or ignoring you.",
  },
  {
    icon: MessageSquare,
    title: "Small businesses",
    body: "Your customers use ChatGPT and Perplexity to find services like yours. Are you in those answers?",
  },
  {
    icon: LineChart,
    title: "Marketing teams",
    body: "Track AI citation visibility as a channel. See trends, compare platforms, and report on progress.",
  },
] as const;

function ForWhoSection() {
  return (
    <section className="border-black border-b-2 bg-[hsl(47,100%,95%)] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 font-bold text-3xl text-black md:text-4xl">
          Built for anyone with an online presence
        </h2>
        <p className="mb-12 font-medium text-black text-xl">
          If AI platforms could be sending you traffic, you should know whether
          they are.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {PERSONAS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-4 rounded-base border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-base border-2 border-black bg-[#F59E0B] shadow-[2px_2px_0px_0px_black]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl">{title}</h3>
              <p className="font-medium leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

function BlogSection({ posts }: { posts: BlogPost[] }) {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex items-baseline justify-between">
          <h2 className="font-bold text-3xl text-black md:text-4xl">
            From the blog
          </h2>
          <Link
            to="/blog"
            className="font-bold text-[#F59E0B] text-base underline underline-offset-4 hover:text-black"
          >
            View all →
          </Link>
        </div>
      </div>
      <BlogPostsGrid posts={posts} limit={3} />
    </section>
  );
}
