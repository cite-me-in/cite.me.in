export default [
  {
    category: "Getting Started",
    questions: [
      {
        question: "What is Cite.me.in?",
        answer:
          "Cite.me.in monitors whether AI platforms cite your domain. We run your search queries across Claude, ChatGPT, Gemini, and Perplexity, record which URLs appear in responses, and show you the trend over time.",
      },
      {
        question: "What is LLM citation visibility?",
        answer:
          "When someone asks an AI platform a question, the AI often cites external sources in its answer. Citation visibility is a measure of how often your domain appears in those citations for queries relevant to your business.",
      },
      {
        question: "Why does LLM citation visibility matter?",
        answer:
          "AI platforms are increasingly how people discover products, services, and information. If you're not being cited, you're invisible to a growing share of search traffic. Cite.me.in tells you where you stand.",
      },
      {
        question: "How do I get started?",
        answer:
          "Create an account and add your domain. We read your site content and suggest 9 queries instantly — you can start monitoring in under a minute without writing a single query yourself. Your first results appear within 24 hours.",
      },
    ],
  },
  {
    category: "How It Works",
    questions: [
      {
        question: "How does Cite.me.in run queries?",
        answer:
          "We use the official APIs for each AI platform with web search enabled — the same experience your potential customers have. We don't simulate or proxy responses.",
      },
      {
        question: "How often are queries run?",
        answer:
          "Queries run once per platform per day. We skip a platform if a run already exists within the last 24 hours, so you always have fresh daily snapshots without redundant API calls.",
      },
      {
        question: "What counts as a citation?",
        answer:
          "A citation is any URL that appears in an AI platform's response to a query. We record the full list of cited URLs and check whether your domain appears — and at what position.",
      },
      {
        question: "Do I have to write my own queries?",
        answer:
          "No. When you add a site, Cite.me.in reads your page content and automatically suggests 9 queries across three intent categories: discovery (users who don't know your brand yet), active search (users looking for exactly what you offer), and comparison (users evaluating their options). You can use them as-is, edit them, or add your own.",
      },
      {
        question: "Can I customize the search queries?",
        answer:
          "Yes. You have full control. Add queries, edit the suggested ones, delete ones that aren't relevant, and organize them into named groups. The suggestions are a starting point — you know your audience best.",
      },
    ],
  },
  {
    category: "Platforms & Data",
    questions: [
      {
        question: "Which AI platforms does Cite.me.in monitor?",
        answer:
          "We currently monitor Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google), and Perplexity. All four are queried in parallel for each monitoring run.",
      },
      {
        question: "How far back does historical data go?",
        answer:
          "From the day you start monitoring. We don't backfill historical data, but your visibility trend builds up automatically with each daily run.",
      },
      {
        question: "What if an AI platform doesn't cite any URLs?",
        answer:
          "We record the response even when no URLs are cited. A zero-citation result is meaningful data — it tells you the platform answered without referencing external sources.",
      },
    ],
  },
  {
    category: "Pricing & Account",
    questions: [
      {
        question: "Is there a free plan?",
        answer:
          "Yes — 25 days free, no credit card required. Most tools give you a week; we give you enough time to actually see results. After 25 days, upgrade to Pro to keep your citation history and continue daily runs.",
      },
      {
        question: "What's included in Pro?",
        answer:
          "Pro is $35/month or $320/year. You get unlimited daily runs, your full citation history, API access, email digests, network benchmarks, and up to 3 domains.",
      },
      {
        question: "Why should I pay when it's open-source?",
        answer:
          "You're right — you can self-host for almost nothing. But running it yourself means keeping it updated, monitoring uptime, and managing LLM API keys. $35/mo gets you all of that handled, plus access to aggregate benchmark data that self-hosting can't give you. And it keeps the project funded and independent.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. Cancel from your billing portal — no long-term commitment, no cancellation fee. Your data stays accessible until the end of the billing period.",
      },
      {
        question: "How do I contact support?",
        answer: `Email us at ${import.meta.env.VITE_EMAIL_FROM}. We respond within 24 hours on business days.`,
      },
    ],
  },
];
