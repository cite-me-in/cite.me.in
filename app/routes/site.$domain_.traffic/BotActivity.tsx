import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

export default function BotActivity({
  botActivity,
}: {
  botActivity: {
    botType: string;
    total: number;
    uniquePaths: number;
    accepts: string[];
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3 font-bold">Bot</TableHead>
              <TableHead className="text-right font-bold">Visits</TableHead>
              <TableHead className="text-right font-bold">Paths</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {botActivity.map((row) => (
              <TableRow key={row.botType}>
                <TableCell className="font-medium">{row.botType}</TableCell>
                <TableCell className="text-right">
                  {row.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">{row.uniquePaths}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
