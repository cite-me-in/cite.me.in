import { Link } from "react-router";

export default function TrialExpired() {
  return (
    <div className="mb-6 rounded-base border-2 border-black bg-amber-100 p-4 shadow-[4px_4px_0px_0px_black]">
      <p className="mb-1 font-bold">Your free trial has ended.</p>
      <p className="mb-3 text-foreground/70 text-sm">
        Your daily runs have paused. Upgrade to keep your citation history and
        resume monitoring.
      </p>
      <Link
        to="/upgrade"
        className="inline-block rounded-base border-2 border-black bg-amber-400 px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        Upgrade to Pro — $35/mo
      </Link>
    </div>
  );
}
