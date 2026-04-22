import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function NoVisitors({ domain }: { domain: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No visitors recorded</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/60 text-base">
          Install the tracking snippet on{" "}
          <span className="font-mono">{domain}</span> to start seeing human
          visitor data here.
        </p>
      </CardContent>
    </Card>
  );
}
