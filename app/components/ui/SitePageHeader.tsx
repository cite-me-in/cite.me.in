import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { ActiveLink } from "./ActiveLink";

export default function SitePageHeader({
  site,
  title,
  backTo,
  children,
}: {
  site: { id: string; domain: string };
  title: string;
  backTo?: { label: string; path: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p>
          <Link
            className="block max-w-md truncate font-mono text-foreground/60 hover:underline"
            to={`/site/${site.id}`}
            title={site.domain}
          >
            {site.domain}
          </Link>
        </p>
        <h1 className="font-heading text-3xl">{title}</h1>
      </div>
      {children}
      {backTo && (
        <ActiveLink
          className="text-base text-foreground/60 hover:underline"
          to={backTo.path}
        >
          {backTo.label}
          <ArrowRightIcon className="size-4" />
        </ActiveLink>
      )}
    </div>
  );
}
