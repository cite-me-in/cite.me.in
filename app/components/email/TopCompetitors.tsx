import Card from "~/components/email/Card";
import Link from "~/components/email/Link";

export function TopCompetitors({
  competitors,
}: {
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
}) {
  if (competitors.length === 0) return null;
  return (
    <Card title="Top competitors" subtitle="Sites appearing in your queries this week" withBorder>
      <table>
        <tbody>
          {competitors.map(({ domain, brandName, url, count, pct }) => (
            <tr key={domain} className="border-border border-t">
              <td className="w-full py-4">
                <Link href={url} className="text-dark no-underline">
                  {brandName}
                </Link>
              </td>
              <td className="w-30 px-2 py-4 font-bold whitespace-nowrap tabular-nums">
                {count.toLocaleString()} {count === 1 ? "citation" : "citations"}
              </td>
              <td className="w-15 px-2 py-4 text-right tabular-nums">{pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
