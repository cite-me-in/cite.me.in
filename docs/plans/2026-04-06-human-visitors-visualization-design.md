# Human Visitors Visualization — Design

**Date:** 2026-04-06
**Status:** Approved

## Goal

Prove that LLM citations drive real human visitors to the monitored site. A new standalone page showing human traffic, with AI-referred traffic broken down by platform relative to total traffic.

## Route

`app/routes/site.$domain_.visitors/route.tsx`

Added to the site nav alongside Bots and Citations.

## Data Model

Query `humanVisit` records filtered by site and date range. Compute:

- **Daily unique visitors** — count of rows per day (each row = one unique visitor per day), grouped by `aiReferral`
- **Totals** — total unique visitors, total page views (sum of `count`), AI-referred visitors, % from AI

### Chart data shape (per day)

```ts
{
  date: string;
  total: number;         // total unique visitors
  nonAi: number;        // visitors with aiReferral == null
  [platform: string]: number; // one key per distinct AI platform with data
}
```

AI platforms are derived dynamically from distinct `aiReferral` values present in the data for that site and date range. No hardcoded platform list — anything in the DB gets rendered. Colors assigned from a fixed palette in order of appearance.

## Page Layout

### 1. Header

"Human Visitors" title + `DateRangeSelector` (same as Bots page).

### 2. Key Metrics Row (4 cards)

- Total unique visitors
- Total page views
- AI-referred visitors
- % of traffic from AI

### 3. Stacked Area Chart — "Traffic by Source"

- X-axis: date
- Y-axis: unique visitors
- Grey base area: non-AI traffic
- Colored areas stacked on top: one per distinct AI platform found in the data
- Tooltip: per-platform breakdown for that day

### 4. Platform Breakdown

Horizontal bar chart (or stat list) showing each AI platform's total visitors and % of overall traffic for the selected period. Only platforms with data are shown.

### 5. Empty State

If no human visits recorded yet, show a message explaining what will appear here.

## Implementation Notes

- Follow the Bots page (`site.$domain_.bots`) as the structural template
- Use `ChartContainer` + Recharts `AreaChart` with `stackId` for stacking
- Derive platform list from data, assign colors from the same palette used in `BotTrafficTrend`
- Unique visitor count = row count (each row is unique per date+site+visitor by schema constraint)
- Page views = sum of `count` field
