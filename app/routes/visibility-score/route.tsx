import { Link } from "react-router";
import { Card, CardContent } from "~/components/ui/Card";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Visibility Score | Cite.me.in" },
    {
      name: "description",
      content:
        "Understanding your LLM visibility score: how we measure your brand's presence across AI-powered search and chat platforms.",
    },
  ];
}

export default function VisibilityScore() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <article>
        <h1 className="mb-4 font-bold text-4xl leading-tight">
          Understanding Your Visibility Score
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          A composite metric (0-100) that measures your brand's presence across
          AI-powered search and chat platforms.
        </p>

        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="mb-4 font-bold text-xl">The Formula</h2>
            <div className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
              <code>
                Visibility Score = (Query Coverage × 0.35) + (Position Score ×
                0.30) + (Share of Voice × 0.20) + (Mention Rate × 0.15)
              </code>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-8">
          <MetricCard
            name="Query Coverage"
            weight={35}
            description="How many different queries cite your domain (breadth)"
            calculation={
              <code>(Queries with your citation ÷ Total queries) × 100</code>
            }
            affects={[
              "How often your content is cited as a source",
              "Relevance of your content to common queries",
              "Quality and authority of your domain",
            ]}
            improve={[
              "Create comprehensive, authoritative content on topics users ask about",
              "Ensure your site is well-structured and easily crawlable",
              "Build domain authority through quality backlinks",
            ]}
          />

          <MetricCard
            name="Position Score"
            weight={30}
            description="Citation rate weighted by how high you appear in results"
            calculation={
              <>
                <code>Σ(1 ÷ (position + 1)) ÷ Total queries × 100</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Position 1 contributes 0.50, position 2 contributes 0.33,
                  position 5 contributes 0.17, etc.
                </p>
              </>
            }
            affects={[
              "How prominently your citation appears",
              "Whether you're the first or fifth source cited",
              "Competitive landscape for each query",
            ]}
            improve={[
              "Create definitive, comprehensive content that LLMs cite first",
              "Focus on queries where you can be the primary source",
              "Differentiate from competitors with unique data or perspectives",
            ]}
          />

          <MetricCard
            name="Share of Voice"
            weight={20}
            description="What slice of all citations belong to you (depth)"
            calculation={<code>(Your citations ÷ Total citations) × 100</code>}
            affects={[
              "How many citations you have relative to competitors",
              "Overall citation volume in your niche",
              "Competitive density in your space",
            ]}
            improve={[
              "Expand content to cover more query types",
              "Increase citation frequency across diverse topics",
              "Monitor competitor citations and identify gaps",
            ]}
          />

          <MetricCard
            name="Mention Rate"
            weight={15}
            description="% of queries where your brand/domain is mentioned in the response text (even without a link)"
            calculation={
              <code>
                (Queries mentioning your domain ÷ Total queries) × 100
              </code>
            }
            affects={[
              "Brand recognition and awareness",
              "How often your brand is discussed alongside your topic",
              "Presence in training data and web content",
            ]}
            improve={[
              "Build brand awareness through content and PR",
              "Ensure your brand name appears in relevant contexts online",
              "Encourage mentions and discussions across the web",
            ]}
          />
        </section>

        <section className="mt-12 rounded-lg bg-muted p-6">
          <h2 className="mb-4 font-bold text-xl">Putting It All Together</h2>
          <p className="text-muted-foreground">
            Your visibility score provides a holistic view of how well your
            brand performs across AI platforms. A score of 50 means you're
            appearing in about half of relevant queries with moderate
            positioning. Scores above 70 indicate strong visibility, while
            scores below 30 suggest significant room for improvement.
          </p>
          <p className="mt-4 text-muted-foreground">
            Track your score over time in your{" "}
            <Link to="/sites" className="underline">
              dashboard
            </Link>{" "}
            to see how content and SEO improvements translate to AI visibility.
          </p>
        </section>
      </article>
    </main>
  );
}

function MetricCard({
  name,
  weight,
  description,
  calculation,
  affects,
  improve,
}: {
  name: string;
  weight: number;
  description: string;
  calculation: React.ReactNode;
  affects: string[];
  improve: string[];
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg">{name}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <div className="text-right">
            <div className="font-bold text-2xl">{weight}%</div>
            <div className="text-muted-foreground text-xs">weight</div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 font-medium text-sm">How It's Calculated</h4>
            <div className="rounded-md bg-muted p-3 text-sm">{calculation}</div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium text-sm">What Affects It</h4>
              <ul className="space-y-1 text-muted-foreground text-sm">
                {affects.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-medium text-sm">How to Improve</h4>
              <ul className="space-y-1 text-muted-foreground text-sm">
                {improve.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
