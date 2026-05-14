import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { ChartContainer } from "~/components/ui/Chart";
import { formatDateMed, formatDateShort } from "~/lib/formatDate";

const NON_AI_COLOR = "#d1d5db";
const PLATFORM_COLORS = [
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#e9c46a",
  "#f4a261",
  "#264653",
  "#a8dadc",
  "#6a4c93",
  "#c77dff",
] as const;

export default function VisitorTrafficChart({
  platforms,
  chartData,
}: {
  platforms: string[];
  chartData: {
    date: string;
    total: number;
    nonAi: number;
    [key: string]: number | string;
  }[];
}) {
  const config = {
    nonAi: { label: "Non-AI", color: NON_AI_COLOR },
    ...Object.fromEntries(
      platforms.map((p, i) => [
        p,
        { label: p, color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] },
      ]),
    ),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Human Visitors by Source</CardTitle>
        <CardDescription className="text-foreground/60">
          This chart shows human visitors and highlights the portion of people who were referred by
          AI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v) => formatDateShort(new Date(v))} />
            <YAxis />
            <Tooltip labelFormatter={(value) => formatDateMed(new Date(value))} />
            <Legend />
            <Area
              dataKey="nonAi"
              fill={NON_AI_COLOR}
              name="Non-AI"
              stackId="a"
              stroke={NON_AI_COLOR}
              type="monotone"
            />
            {platforms.map((p, i) => (
              <Area
                dataKey={p}
                fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                key={p}
                name={p}
                stackId="a"
                stroke={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
