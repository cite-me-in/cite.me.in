import {
  BarChart2Icon,
  GlobeIcon,
  LineChartIcon,
  MessageSquareIcon,
  SearchIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigation } from "react-router";
import LandingPageNav from "~/components/layout/LandingPageNav";
import Main from "~/components/ui/Main";
import Spinner from "~/components/ui/Spinner";
import { requireUserAccess } from "~/lib/auth.server";
import { validateDomainInput } from "~/lib/validation";
import type { Route } from "./+types/route";

const PERSONAS = [
  {
    icon: TrendingUpIcon,
    title: "Solo founders",
    body: "You're building an audience and want to know if AI platforms are sending you traffic — or ignoring you.",
  },
  {
    icon: MessageSquareIcon,
    title: "Small businesses",
    body: "Your customers use ChatGPT, Claude, and Gemini to find services like yours. Are you in those answers?",
  },
  {
    icon: LineChartIcon,
    title: "Marketing teams",
    body: "Track AI citation visibility as a channel. See trends, compare platforms, and report on progress.",
  },
] as const;

const STEPS = [
  {
    number: "1",
    title: "Add your website",
    body: "Enter your domain. We read your content and instantly suggest 9 ready-to-run queries — covering discovery, comparison, and direct searches — so you're tracking in under a minute. No setup required.",
    icon: GlobeIcon,
  },
  {
    number: "2",
    title: "We run the queries",
    body: "Each week we run your queries across every major AI platform with web search enabled — the same experience your potential customers have.",
    icon: SearchIcon,
  },
  {
    number: "3",
    title: "You see the citations",
    body: "Every URL that appears in an AI response gets recorded. You see which platforms cite you, how often, and for which queries.",
    icon: BarChart2Icon,
  },
] as const;

export const handle = { hideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const user = await requireUserAccess(request);
    return { user };
  } catch {
    return { user: null };
  }
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Cite.me.in — Monitor LLM Citation Visibility" },
    {
      name: "description",
      content:
        "Track when ChatGPT, Claude, and Gemini cite your brand. Cite.me.in is the Search Console for AI platforms. Squirrel-brain friendly.",
    },
  ];
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <Main className="w-full bg-[hsl(60,100%,99%)]">
      <LandingPageNav isSignedIn={!!user} />
      <HeroSection />
      <HowItWorksSection />
      <ForWhoSection />
    </Main>
  );
}

function HeroSection() {
  const navigation = useNavigation();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="border-b-2 border-black bg-[#F59E0B] px-6 py-20 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <blockquote className="mb-4 inline-flex items-center gap-2 rounded-full border-2 bg-white px-4 py-1.5 text-base font-bold text-black shadow-md">
            <SparklesIcon className="h-4 w-4" />
            Squirrel-brain friendly 🐿️
          </blockquote>

          <h1 className="mb-6 text-4xl leading-tight font-bold text-black md:text-6xl">
            Does ChatGPT mention
            <br />
            your brand?
          </h1>

          <p className="mb-8 max-w-2xl text-xl leading-relaxed font-medium text-black md:text-2xl">
            Most founders are running blind on AI visibility. Cite.me.in runs
            your queries across ChatGPT, Claude, and Gemini and records every
            time they cite your website. See what's working. Fix what's not.
          </p>

          <form
            method="get"
            action="/try"
            className="mb-6"
            onSubmit={(e) => {
              const form = e.currentTarget;
              const raw = new FormData(form).get("domain") as string;
              const validation = validateDomainInput(raw);
              if (!validation.valid) {
                e.preventDefault();
                setError(validation.error ?? null);
                return;
              }
              setError(null);
            }}
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <GlobeIcon className="pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-black/40" />
                <input
                  name="domain"
                  placeholder="yourwebsite.com"
                  className="rounded-base h-14 w-full border-2 border-black bg-white pr-4 pl-12 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_black]"
                />
              </div>
              <button
                type="submit"
                className="rounded-base inline-flex h-14 shrink-0 items-center gap-2 border-2 border-black bg-blue-500 px-6 text-lg font-bold text-white shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
              >
                {navigation.state === "loading" &&
                navigation.location?.pathname === "/try" ? (
                  <Spinner white />
                ) : (
                  <SearchIcon className="h-5 w-5" />
                )}
                Scan now
              </button>
            </div>
            {error && (
              <p className="mt-3 text-left text-sm font-bold text-red-600">
                {error}
              </p>
            )}
          </form>
        </div>

        <div className="rounded-base overflow-hidden border-2 border-black shadow-[8px_8px_0px_0px_black]">
          <img
            src="/images/hero-screenshot.png"
            alt="Cite.me.in dashboard showing AI citation tracking across ChatGPT, Claude, and Gemini"
            className="w-full"
          />
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="border-b-2 border-black px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-3xl font-bold text-black md:text-4xl">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ number, title, body, icon: Icon }) => (
            <div
              key={number}
              className="rounded-base flex flex-col gap-4 border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-base flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-[#F59E0B] font-bold shadow-[2px_2px_0px_0px_black]">
                  {number}
                </div>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="leading-relaxed font-medium">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForWhoSection() {
  return (
    <section className="border-b-2 border-black bg-[hsl(47,100%,95%)] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-3xl font-bold text-black md:text-4xl">
          Built for anyone with an online presence
        </h2>
        <p className="mb-12 text-xl font-medium text-black">
          If AI platforms could be sending you traffic, you should know whether
          they are.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {PERSONAS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-base flex flex-col gap-4 border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]"
            >
              <div className="rounded-base flex h-12 w-12 items-center justify-center border-2 border-black bg-[#F59E0B] shadow-[2px_2px_0px_0px_black]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="leading-relaxed font-medium">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
