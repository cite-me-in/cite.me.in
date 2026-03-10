import {
  CornerDownRightIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UnlockIcon,
  UserIcon,
} from "lucide-react";
import type { User } from "prisma/generated/client";
import { useEffect, useRef, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import { twMerge } from "tailwind-merge";
import { Button, buttonVariants } from "~/components/ui/Button";
import type { loader as rootLoader } from "~/root";

export default function AccountMenu({ className }: { className?: string }) {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const user = data?.user;
  const sites = data?.sites ?? [];

  // Show sign-in link for non-authenticated users
  return (
    <div
      className={twMerge("inline-flex items-center justify-center", className)}
    >
      {user ? <DropdownMenu user={user} sites={sites} /> : <SignInButton />}
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
}: {
  user: User;
  sites: { id: string; domain: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
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
        <menu className="absolute top-10 right-0 z-50 mt-2 w-48 rounded-base border-2 border-black bg-white py-1 shadow-[4px_4px_0px_0px_black]">
          <li className="border-black border-b-2 px-4 py-2 text-gray-600">
            <p className="truncate font-bold">{user.email}</p>
          </li>

          <li>
            <AccountMenuItem
              to="/sites"
              icon={<LayoutDashboardIcon className="mr-2 size-4" />}
              label="Dashboard"
            />
          </li>

          {sites.map((site) => (
            <li key={site.id}>
              <AccountMenuItem
                to={`/site/${site.id}`}
                icon={<CornerDownRightIcon className="mr-2 size-4" />}
                label={site.domain}
              />
            </li>
          ))}

          <li>
            <AccountMenuItem
              to="/profile"
              icon={<UserIcon className="mr-2 size-4" />}
              label="Profile Settings"
            />
          </li>

          <li>
            <AccountMenuItem
              to="/account"
              icon={<SettingsIcon className="mr-2 size-4" />}
              label="Account"
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

function AccountMenuItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex w-full items-center px-4 py-2 text-left font-medium text-black transition-colors hover:bg-[hsl(47,100%,95%)] hover:text-[#F59E0B]"
      >
        {icon}
        {label}
      </Link>
    </li>
  );
}
