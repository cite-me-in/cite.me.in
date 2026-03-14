import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

export default function BotAcceptTypes({
  mimeTypes,
}: {
  mimeTypes: { mime: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Types</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>MIME Type</TableHead>
              <TableHead className="text-right">Visits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mimeTypes.map((row) => (
              <TableRow key={row.mime}>
                <TableCell className="font-mono">{row.mime}</TableCell>
                <TableCell className="text-right">
                  {row.count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
