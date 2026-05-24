import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

/**
 * Shared Card+Table wrapper for traffic data tables.
 */
export default function CardTable({
  children,
  columns,
  title,
}: {
  children: ReactNode;
  columns: { className?: string; label: string }[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.label} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
