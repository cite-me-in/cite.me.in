export default function NoVisitors({ domain }: { domain: string }) {
  return (
    <div className="rounded border-2 border-black p-8 text-center">
      <p className="font-bold text-lg">No visitors recorded</p>
      <p className="mt-2 text-foreground/60">
        Install the tracking snippet on{" "}
        <span className="font-mono">{domain}</span> to start seeing human
        visitor data here.
      </p>
    </div>
  );
}
