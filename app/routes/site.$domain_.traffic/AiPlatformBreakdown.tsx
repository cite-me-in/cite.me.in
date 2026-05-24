import CardTable from "~/components/ui/CardTable";
import { TableCell, TableRow } from "~/components/ui/Table";

export default function AiPlatformBreakdown({
  platformBreakdown,
}: {
  platformBreakdown: { platform: string; visitors: number; pct: number }[];
}) {
  return (
    <CardTable
      title="AI Platform Breakdown"
      columns={[
        { label: "Platform", className: "w-2/3 font-bold" },
        { label: "Visitors", className: "text-right font-bold" },
        { label: "% of Total", className: "text-right font-bold" },
      ]}
    >
      {platformBreakdown.length === 0 ? (
        <TableRow>
          <TableCell colSpan={3} className="text-foreground/60 text-center">
            No AI referrals in this period
          </TableCell>
        </TableRow>
      ) : (
        platformBreakdown.map((row) => (
          <TableRow key={row.platform}>
            <TableCell className="font-medium">{row.platform}</TableCell>
            <TableCell className="text-right">{row.visitors.toLocaleString()}</TableCell>
            <TableCell className="text-right">{row.pct.toFixed(2)}%</TableCell>
          </TableRow>
        ))
      )}
    </CardTable>
  );
}
