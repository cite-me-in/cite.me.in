import { SparklesIcon } from "lucide-react";

export default function SignUpSection({ domain }: { domain: string }) {
  return (
    <section className="border-b-2 border-black bg-[hsl(47,100%,95%)] px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">
          Turn this into weekly monitoring
        </h2>
        <p className="mb-10 text-lg font-medium text-black/70">
          Create a free account. We'll add your site, run 9 queries across
          ChatGPT, Claude, Gemini, Copilot, and Perplexity every week — so you
          know exactly which fixes moved the needle.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`/sign-up${domain ? `?next=/try?domain=${encodeURIComponent(domain)}` : ""}`}
            className="rounded-base inline-flex items-center gap-2 border-2 border-black bg-amber-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
          >
            <SparklesIcon className="h-5 w-5" />
            Start monitoring — free
          </a>
          <a
            href="/pricing"
            className="rounded-base border-2 border-black bg-white px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
          >
            See pricing
          </a>
        </div>
      </div>
    </section>
  );
}
