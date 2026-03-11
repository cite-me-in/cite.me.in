import { Link } from "react-router";
import { twMerge } from "tailwind-merge";

export default function CiteMeInLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={twMerge(
        "flex flex-nowrap items-center",
        "font-bold text-2xl leading-none",
        "transition-colors hover:text-[#F59E0B]",
        className,
      )}
      aria-label="Go to home page"
    >
      <img alt="Cite.me.in" height={42} src="/icon-192.png" width={42} />
      <span className="text-[#F59E0B]">Cite.me.in</span>
    </Link>
  );
}
