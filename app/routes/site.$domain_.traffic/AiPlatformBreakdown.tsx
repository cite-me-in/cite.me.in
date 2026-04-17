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
              <TableHead className="w-2/3 font-bold">Platform</TableHead>
              <TableHead className="text-right font-bold">Visitors</TableHead>
              <TableHead className="text-right font-bold">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platformBreakdown.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-foreground/60"
                >
                  No AI referrals in this period
                </TableCell>
              </TableRow>
            ) : (
              platformBreakdown.map((row) => (
                <TableRow key={row.platform}>
                  <TableCell className="font-medium">{row.platform}</TableCell>
                  <TableCell className="text-right">
                    {row.visitors.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.pct.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
