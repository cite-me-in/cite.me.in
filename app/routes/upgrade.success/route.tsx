import { Link } from "react-router";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import type { Route } from "./+types/route";

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
        <h1 className="mb-4 font-heading text-4xl">You're on Pro!</h1>
        <p className="mb-8 text-foreground/70">
          Your subscription is active. Daily runs will continue, your citation
          history is preserved, and your API access is enabled.
        </p>
        <Link
          to="/sites"
          className="inline-block rounded-base border-2 border-black bg-amber-400 px-6 py-3 font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_black]"
        >
          Go to Dashboard
        </Link>
      </div>
    </Main>
  );
}
