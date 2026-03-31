import { FrownIcon } from "lucide-react";
import { data } from "react-router";
import { ActiveLink } from "~/components/ui/ActiveLink";
import Main from "~/components/ui/Main";
import captureAndLogError from "~/lib/captureAndLogError.server";
import type { Route } from "./+types/$";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "404 — Page not found" },
    { name: "description", content: "Page not found" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const response = await fetch("https://agent404.dev/api/suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "key_b4a80066ecff4caf8ece40f3a6c19cb0",
      },
      body: JSON.stringify({ url: request.url }),
      signal: AbortSignal.timeout(3_000),
    });
    const { suggestions } = (await response.json()) as {
      deadUrl: string;
      suggestions: [
        {
          url: string;
          title: string;
        },
      ];
    };
    return data({ suggestions }, { status: 404 });
  } catch (error) {
    captureAndLogError(error);
    return data({ suggestions: [] }, { status: 404 });
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { suggestions } = loaderData;
  return (
    <Main variant="prose">
      <h1 className="mx-auto flex flex-row items-center justify-center gap-2 text-4xl">
        <span className="font-bold text-red-500">404</span>
        <span className="text-gray-500">Page not found</span>
        <FrownIcon size={32} color="#eab308" />
      </h1>

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">
            Maybe you were looking for one of these?
          </h3>
          <ul className="list-none px-0">
            {suggestions.map((suggestion) => (
              <li key={suggestion.url} className="list-item px-0">
                <ActiveLink to={suggestion.url}>{suggestion.title}</ActiveLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Main>
  );
}
