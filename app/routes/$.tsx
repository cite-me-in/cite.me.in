import { FrownIcon } from "lucide-react";
import Main from "~/components/ui/Main";
import type { Route } from "./+types/$";

export function meta(): Route.MetaDescriptors {
  return [{ title: "404 — Page not found" }, { name: "description", content: "Page not found" }];
}

export default function FourOhFour() {
  return (
    <Main variant="prose">
      <h1 className="mx-auto flex flex-row items-center justify-center gap-2 text-4xl">
        <span className="font-bold text-red-500">404</span>
        <span className="text-gray-500">Page not found</span>
        <FrownIcon size={32} color="#eab308" />
      </h1>
    </Main>
  );
}
