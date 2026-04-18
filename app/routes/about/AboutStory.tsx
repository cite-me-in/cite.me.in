import { LightbulbIcon } from "lucide-react";

export default function AboutStory() {
  return (
    <section className="mx-auto max-w-4xl bg-[hsl(60,100%,99%)] py-20">
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-base border-2 border-black bg-[#F59E0B] text-black shadow-[2px_2px_0px_0px_black]">
            <LightbulbIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="mb-4 font-bold text-3xl text-black leading-tight">
              Our Story
            </h2>
            <div className="flex flex-col gap-4 font-medium text-black text-lg leading-relaxed">
              <p>
                Cite.me.in started with a question we couldn't answer: when
                someone asks Claude or ChatGPT about our space, do they mention
                us? The answer mattered — AI platforms are increasingly where
                people discover products and services — but there was no easy
                way to find out.
              </p>
              <p>
                In 2026, we built the tool we needed: run your search queries
                across every major AI platform, record exactly which URLs appear
                in responses, and show you the trend over time. No guessing, no
                manual spot-checking.
              </p>
              <p>
                It worked better than expected. We spent nothing on ads, yet 12%
                of visitors converted. That's when we knew this wasn't just a
                side project — we turned it into Cite.me.in so other brands
                could see the same clarity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
