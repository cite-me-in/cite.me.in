import { BarChartIcon, SearchIcon, SparklesIcon } from "lucide-react";

export default function BenefitsSection() {
  return (
    <section className="border-b-2 border-black px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <BenefitCard
            icon={SearchIcon}
            title="Scan your site"
            body="Type your URL and we analyze 13 AI legibility signals — sitemaps, robots.txt, JSON-LD, content quality, and more."
          />
          <BenefitCard
            icon={BarChartIcon}
            title="See what matters"
            body="A color-coded score shows where you stand — so you know exactly what to tackle first."
          />
          <BenefitCard
            icon={SparklesIcon}
            title="Fix with AI"
            body="Copy ready-made prompts for your coding agent. Paste into Cursor, Copilot, or Claude — each issue fixes in minutes."
          />
        </div>
      </div>

      <SocialProofBand />
    </section>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-base flex flex-col gap-4 border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]">
      <div className="rounded-base flex h-12 w-12 items-center justify-center border-2 border-black bg-amber-400 shadow-[2px_2px_0px_0px_black]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="leading-relaxed font-medium text-black/70">{body}</p>
    </div>
  );
}

function SocialProofBand() {
  return (
    <div className="mt-12 flex justify-center">
      <div className="rounded-full border-2 border-black bg-white px-6 py-3 text-lg font-semibold shadow-[2px_2px_0px_0px_black]">
        <span>
          We already scanned <span className="font-extrabold text-amber-500">100+</span> sites. Are
          you next?
        </span>
      </div>
    </div>
  );
}
