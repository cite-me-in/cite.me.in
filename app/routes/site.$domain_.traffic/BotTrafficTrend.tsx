import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { ChartContainer } from "~/components/ui/Chart";
import { formatDateMed, formatDateShort } from "~/lib/formatDate";

const colors = [
  "#111111",
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

export default function BotTrafficTrend({
  topBots,
  chartData,
}: {
  topBots: string[];
  chartData: { date: string; total: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={Object.fromEntries(
            topBots.map((bot, i) => [
              bot,
              { label: bot, color: colors[i % colors.length] },
            ]),
          )}
          className="h-48 w-full"
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDateShort(new Date(v))}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => formatDateMed(new Date(value))}
            />
            <Legend />
            <Line
              dataKey="total"
              name="Total"
              stroke="#111111"
              strokeWidth={2}
              type="monotone"
            />
            {topBots.slice(0, 5).map((bot, i) => (
              <Line
                dataKey={bot}
                key={bot}
                name={bot}
                stroke={colors[(i + 1) % colors.length]}
                strokeDasharray="4 2"
                strokeWidth={1.5}
                type="monotone"
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
