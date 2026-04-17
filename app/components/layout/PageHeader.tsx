import { last } from "radashi";
import { SettingsIcon } from "lucide-react";
import { NavLink, type UIMatch, useMatches } from "react-router";
import { twMerge } from "tailwind-merge";
import AccountMenu from "./AccountMenu";
import CiteMeInLogo from "./CiteMeInLogo";

export default function PageHeader() {
  const matches = useMatches() as UIMatch<unknown, { hideHeader?: boolean }>[];
  const lastHandle = last(matches.filter((m) => m.handle))?.handle;
  if (lastHandle?.hideHeader) return null;

  return (
    <header className="z-10 flex min-h-16 w-full items-center border-black border-b-2 bg-[hsl(60,100%,99%)] p-2 print:hidden">
      <CiteMeInLogo className="w-1/2" />
      <HeaderLinks />
      <AccountMenu className="w-1/2 justify-end" />
    </header>
  );
}

function HeaderLinks() {
  const matches = useMatches() as UIMatch<unknown, { siteNav?: boolean }>[];
  const navLinks = [];
  const siteMatch = matches.find((m) => m.handle?.siteNav);
  const siteDomain = siteMatch?.params.domain as string | undefined;
  if (siteMatch) navLinks.push({ to: "/sites", label: "Dashboard" });
  if (siteDomain)
    navLinks.push(
      { to: `/site/${siteDomain}/citations`, label: "Citations" },
      { to: `/site/${siteDomain}/pages`, label: "Pages" },
      { to: `/site/${siteDomain}/traffic`, label: "Traffic" },
      { to: `/site/${siteDomain}/settings`, label: <SettingsIcon size={20} /> },
    );

  return (
    <nav className="hidden items-center gap-6 whitespace-nowrap md:flex">
      {navLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            twMerge(
              "whitespace-nowrap font-bold text-base text-black",
              "transition-colors hover:text-[#F59E0B]",
              isActive && "text-[#F59E0B]",
            )
          }
          viewTransition
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
