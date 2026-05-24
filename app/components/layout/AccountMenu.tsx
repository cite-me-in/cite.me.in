import {
  CornerDownRightIcon,
  LayoutDashboardIcon,
  StarIcon,
  UnlockIcon,
  UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import { twMerge } from "tailwind-merge";
import { Button, buttonVariants } from "~/components/ui/Button";
import type { loader as rootLoader } from "~/root";

export default function AccountMenu({ className }: { className?: string }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const user = data?.user;
  const sites = data?.sites ?? [];
  const isPro = data?.isPro ?? false;

  // Show sign-in link for non-authenticated users
  return (
    <div className={twMerge("inline-flex items-center justify-center", className)}>
      {user ? <DropdownMenu user={user} sites={sites} isPro={isPro} /> : <SignInButton />}
    </div>
  );
}

function SignInButton() {
  return (
    <Link
      to="/sign-in"
      aria-label="Go to sign in page"
      className={buttonVariants({ size: "default", className: "h-9" })}
    >
      Sign In
    </Link>
  );
}

function DropdownMenu({
  user,
  sites,
  isPro,
}: {
  user: { id: string; email: string };
  sites: { id: string; domain: string }[];
  isPro: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative text-base" ref={dropdownRef}>
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        variant="ghost"
      >
        <UserIcon className="h-4 w-4" />
        <span className="max-w-[200px] truncate">{user.email}</span>
      </Button>

      {isOpen && (
        <menu className="rounded-base absolute top-10 right-0 z-50 mt-2 w-48 border-2 border-black bg-white py-1 shadow-[4px_4px_0px_0px_black]">
          <li className="border-b-2 border-black px-4 py-2 text-gray-600">
            <p className="truncate font-bold">{user.email}</p>
          </li>

          <li>
            <AccountMenuLink
              to="/sites"
              icon={<LayoutDashboardIcon className="mr-2 size-4" />}
              label="Dashboard"
            />
          </li>

          {sites.map((site) => (
            <li key={site.id}>
              <AccountMenuLink
                className="pl-8 text-black/80"
                to={`/site/${site.domain}`}
                icon={<CornerDownRightIcon className="mr-2 size-4" />}
                label={site.domain}
              />
            </li>
          ))}

          {!isPro && (
            <li>
              <AccountMenuLink
                to="/upgrade"
                icon={<StarIcon className="mr-2 size-4 text-amber-500" />}
                label="Upgrade to Pro"
              />
            </li>
          )}

          <li>
            <AccountMenuLink
              to="/profile"
              icon={<UserIcon className="mr-2 size-4" />}
              label="Profile Settings"
            />
          </li>

          <li>
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                window.location.href = "/sign-out";
              }}
              className="block w-full px-4 py-2 text-left font-medium text-black transition-colors hover:bg-[hsl(47,100%,95%)] hover:text-[#F59E0B]"
            >
              <UnlockIcon className="mr-2 inline-block h-4 w-4" />
              Sign Out
            </button>
          </li>
        </menu>
      )}
    </div>
  );
}

function AccountMenuLink({
  className,
  icon,
  label,
  to,
}: {
  className?: string;
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className={twMerge(
        "flex items-center truncate px-4 py-2 text-left font-medium text-black transition-colors hover:bg-[hsl(47,100%,95%)] hover:text-[#F59E0B]",
        className,
      )}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
