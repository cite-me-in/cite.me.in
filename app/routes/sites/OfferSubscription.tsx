import { Button } from "~/components/ui/Button";

export default function OfferSubscription() {
  return (
    <div className="rounded-base border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black]">
      <h2 className="mb-1 font-heading text-xl">Upgrade to Pro</h2>
      <p className="mb-5 text-foreground/70 text-sm">
        Monitor all 4 AI platforms. Full citation history. Up to 5 sites.
      </p>
      <div className="flex flex-wrap gap-3">
        <form method="post" action="/upgrade">
          <input type="hidden" name="interval" value="monthly" />
          <Button type="submit">Subscribe — $35/month</Button>
        </form>
        <form method="post" action="/upgrade">
          <input type="hidden" name="interval" value="annual" />
          <Button type="submit" className="bg-emerald-400">
            Subscribe — $320/year{" "}
            <span className="font-normal">(save $99)</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
