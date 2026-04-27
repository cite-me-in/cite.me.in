import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import TIERS from "~/lib/aiLegibility/criteria";

export default function AiLegibilityCriteria() {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle>About These Checks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-base">
        <p className="text-foreground/70 leading-relaxed">
          These checks measure how easily AI agents (ChatGPT, Claude, Gemini,
          Perplexity) can discover, read, and understand your content. Each tier
          represents a dependency layer:
        </p>

        <div className="space-y-2">
          {TIERS.map((tier) => (
            <p key={tier.key}>
              <strong className={tier.color}>
                {tier.title.split(" — ")[0]}
              </strong>{" "}
              — {tier.description}
            </p>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div key={tier.key} className="rounded-lg border p-4">
              <h4 className={`mb-2 font-bold ${tier.color}`}>{tier.title}</h4>
              <ul className="space-y-1">
                {tier.checks.map((check) => (
                  <li key={check.name} className="text-foreground/70">
                    <strong>{check.name}</strong> — {check.desc}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
