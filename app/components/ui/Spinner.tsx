import { twMerge } from "tailwind-merge";

export default function Spinner({
  size = 6,
  white = false,
}: {
  size?: number;
  white?: boolean;
}) {
  return (
    <div
      className={twMerge(
        `size-${size} animate-spin rounded-full border-2`,
        white
          ? "border-white/20 border-t-white"
          : "border-foreground/20 border-t-foreground",
      )}
    ></div>
  );
}
