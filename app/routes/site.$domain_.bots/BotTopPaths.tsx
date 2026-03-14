import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

export default function BotTopPaths({
  topPaths,
}: {
  topPaths: { path: string; count: number; uniqueBots: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Paths</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Path</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Bots</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topPaths.map((row) => (
              <TableRow key={row.path}>
                <TableCell className="font-mono">{row.path}</TableCell>
                <TableCell className="text-right">
                  {row.count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">{row.uniqueBots}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
