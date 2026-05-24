import { Link } from "react-router";
import prices from "~/data/stripe-prices.json";

export default function TrialExpired() {
  return (
    <div className="rounded-base mb-6 border-2 border-black bg-amber-100 p-4 shadow-[4px_4px_0px_0px_black]">
      <p className="mb-1 font-bold">Your free trial has ended.</p>
      <p className="text-foreground/70 mb-3 text-sm">
        Your daily runs have paused. Upgrade to keep your citation history and resume monitoring.
      </p>
      <Link
        to="/upgrade"
        className="rounded-base inline-block border-2 border-black bg-amber-400 px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_black] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        Upgrade to Pro — ${prices.monthlyAmount}/mo
      </Link>
    </div>
  );
}
