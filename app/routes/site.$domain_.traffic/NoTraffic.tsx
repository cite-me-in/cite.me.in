import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function NoTraffic({ domain }: { domain: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No bot traffic recorded</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base text-foreground/60">
          Bot visits are tracked automatically. Check back once bots have
          crawled {domain}.
        </p>
      </CardContent>
    </Card>
  );
}
