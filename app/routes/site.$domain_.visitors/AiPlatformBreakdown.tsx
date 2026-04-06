import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

export default function AiPlatformBreakdown({
  platformBreakdown,
}: {
  platformBreakdown: { platform: string; visitors: number; pct: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Platform Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platformBreakdown.map((row) => (
              <TableRow key={row.platform}>
                <TableCell className="font-medium">{row.platform}</TableCell>
                <TableCell className="text-right">
                  {row.visitors.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">{row.pct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
