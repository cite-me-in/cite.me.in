import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { ActiveLink } from "./ActiveLink";

export default function SiteHeading({
  site,
  title,
  subtitle,
  backTo,
  children,
}: {
  site: { domain: string };
  title: string;
  subtitle?: string | null;
  backTo?: { label: string; path: string } | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p>
          <Link
            className="text-foreground/60 block max-w-md truncate font-mono hover:underline"
            to={`/site/${site.domain}`}
            title={site.domain}
          >
            {site.domain}
          </Link>
        </p>
        <h1 className="font-heading text-3xl">{title}</h1>
        {subtitle && (
          <p className="text-foreground/60 mt-1 text-base">{subtitle}</p>
        )}
      </div>

      {children}

      {backTo && (
        <ActiveLink
          className="text-foreground/60 text-base hover:underline"
          to={backTo.path}
        >
          {backTo.label}
          <ArrowRightIcon className="size-4" />
        </ActiveLink>
      )}
    </div>
  );
}
