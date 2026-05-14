import { Dialog } from "@base-ui/react/dialog";
import {
  BotIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { twMerge } from "tailwind-merge";
import { DialogOverlay, DialogPortal } from "~/components/ui/Dialog";
import type { loader as rootLoader } from "~/root";

type CommandItem = {
  id: string;
  label: string;
  to: string;
  icon: React.ReactNode;
};

type CommandGroup = {
  id: string;
  label: string;
  items: CommandItem[];
};

export default function CommandPalette() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const user = data?.user ?? null;
  const sites = useMemo(() => data?.sites ?? [], [data?.sites]);
  const isPro = data?.isPro ?? false;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const navigate = useNavigate();

  const groups: CommandGroup[] = useMemo(() => {
    if (!user) return [];

    const nav: CommandGroup = {
      id: "nav",
      label: "Navigation",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          to: "/sites",
          icon: <LayoutDashboardIcon className="size-4" />,
        },
        {
          id: "profile",
          label: "Profile Settings",
          to: "/profile",
          icon: <UserIcon className="size-4" />,
        },
        ...(!isPro
          ? [
              {
                id: "upgrade",
                label: "Upgrade to Pro",
                to: "/upgrade",
                icon: <StarIcon className="size-4 text-amber-500" />,
              },
            ]
          : []),
      ],
    };

    const siteGroups: CommandGroup[] = sites.map((site) => ({
      id: `site-${site.id}`,
      label: site.domain,
      items: [
        {
          id: `${site.id}-citations`,
          label: `${site.domain} → Citations`,
          to: `/site/${site.domain}/citations`,
          icon: <FileTextIcon className="size-4" />,
        },
        {
          id: `${site.id}-traffic`,
          label: `${site.domain} → Traffic`,
          to: `/site/${site.domain}/traffic`,
          icon: <BotIcon className="size-4" />,
        },
        {
          id: `${site.id}-queries`,
          label: `${site.domain} → Queries`,
          to: `/site/${site.domain}/queries`,
          icon: <SearchIcon className="size-4" />,
        },
        {
          id: `${site.id}-suggestions`,
          label: `${site.domain} → Suggestions`,
          to: `/site/${site.domain}/suggestions`,
          icon: <LightbulbIcon className="size-4" />,
        },
        {
          id: `${site.id}-settings`,
          label: `${site.domain} → Settings`,
          to: `/site/${site.domain}/settings`,
          icon: <SettingsIcon className="size-4" />,
        },
      ],
    }));

    return [nav, ...siteGroups];
  }, [user, sites, isPro]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups =
    normalizedQuery === ""
      ? groups
      : groups
          .map((g) => ({
            ...g,
            items: g.items.filter((i) => i.label.toLowerCase().includes(normalizedQuery)),
          }))
          .filter((g) => g.items.length > 0);

  const flatItems = filteredGroups.flatMap((g) => g.items);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const item = flatItems[activeIndex];
    if (item) itemRefs.current.get(item.id)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flatItems]);

  function setItemRef(id: string, el: HTMLButtonElement | null) {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) {
        void navigate(item.to);
        setOpen(false);
      }
    }
  }

  function handleSelect(to: string) {
    void navigate(to);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogPortal>
        <DialogOverlay />
        <Dialog.Popup
          className={twMerge(
            "fixed top-[10vh] left-[50%] z-50 translate-x-[-50%]",
            "w-full max-w-[calc(100%-2rem)] sm:max-w-xl",
            "flex flex-col overflow-hidden rounded-base",
            "border-2 border-black bg-white shadow-[4px_4px_0px_0px_black]",
            "transition-all duration-200",
            "data-starting-style:-translate-y-2 data-starting-style:opacity-0",
            "data-ending-style:-translate-y-2 data-ending-style:opacity-0",
          )}
        >
          <div className="relative border-b-2 border-black">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search commands or ask anything…"
              className="font-base w-full bg-transparent py-3 pr-10 pl-10 text-base placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className={twMerge(
                "absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 transition-colors hover:text-black",
                !query && "invisible",
              )}
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No commands found.</p>
            ) : (
              filteredGroups.map((group) => (
                <CommandGroup
                  key={group.id}
                  group={group}
                  flatItems={flatItems}
                  activeIndex={activeIndex}
                  onSelect={handleSelect}
                  onHover={setActiveIndex}
                  setItemRef={setItemRef}
                />
              ))
            )}
          </div>
          <div className="flex gap-4 border-t-2 border-black px-4 py-2 text-xs text-gray-400">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> open
            </span>
            <span>
              <kbd className="font-mono">esc</kbd> close
            </span>
          </div>
        </Dialog.Popup>
      </DialogPortal>
    </Dialog.Root>
  );
}

function CommandGroup({
  group,
  flatItems,
  activeIndex,
  onSelect,
  onHover,
  setItemRef,
}: {
  group: CommandGroup;
  flatItems: CommandItem[];
  activeIndex: number;
  onSelect: (to: string) => void;
  onHover: (index: number) => void;
  setItemRef: (id: string, el: HTMLButtonElement | null) => void;
}) {
  return (
    <div>
      <p className="px-4 py-1.5 text-xs font-bold tracking-wider text-gray-400 uppercase">
        {group.label}
      </p>
      {group.items.map((item) => {
        const index = flatItems.findIndex((f) => f.id === item.id);
        return (
          <CommandItem
            key={item.id}
            item={item}
            index={index}
            isActive={index === activeIndex}
            onSelect={onSelect}
            onHover={onHover}
            setRef={(el) => setItemRef(item.id, el)}
          />
        );
      })}
    </div>
  );
}

function CommandItem({
  item,
  index,
  isActive,
  onSelect,
  onHover,
  setRef,
}: {
  item: CommandItem;
  index: number;
  isActive: boolean;
  onSelect: (to: string) => void;
  onHover: (index: number) => void;
  setRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={setRef}
      type="button"
      data-active={isActive}
      onClick={() => onSelect(item.to)}
      onMouseEnter={() => onHover(index)}
      className={twMerge(
        "flex w-full items-center gap-3 px-4 py-2 text-left font-medium text-black text-sm transition-colors",
        "data-[active=true]:bg-[hsl(47,100%,95%)] data-[active=true]:text-[#F59E0B]",
      )}
    >
      {item.icon}
      {item.label}
    </button>
  );
}
