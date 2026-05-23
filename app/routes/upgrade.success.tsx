import { Link } from "react-router";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import type { Route } from "./+types/upgrade.success";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Welcome to Pro | Cite.me.in" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserAccess(request);
  return {};
}

export default function UpgradeSuccessPage() {
  return (
    <Main>
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-heading mb-4 text-4xl">You're on Pro!</h1>
        <p className="text-foreground/70 mb-8">
          Your subscription is active. Daily runs will continue, your citation
          history is preserved, and your API access is enabled.
        </p>
        <Link
          to="/sites"
          className="rounded-base inline-block border-2 border-black bg-amber-400 px-6 py-3 font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_black]"
        >
          Go to Dashboard
        </Link>
      </div>
    </Main>
  );
}
