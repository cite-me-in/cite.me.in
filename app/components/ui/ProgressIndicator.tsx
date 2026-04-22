import { Progress } from "@base-ui/react/progress";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

export default function ProgressIndicator({
  className,
  value,
  ...props
}: React.ComponentProps<typeof Progress.Root> & { value: number }) {
  return (
    <Progress.Root
      value={value}
      className={twMerge(
        "relative grid h-4 w-full grid-cols-2 grid-rows-1 rounded-base border-2 border-border bg-secondary-background",
        className?.toString(),
      )}
      {...props}
    >
      <Progress.Track
        style={{ gridColumn: "1 / 3" }}
        className="box-shadow var-color-gray-200 inset-0-0-0-1px border-radius-0-25rem h-full overflow-hidden bg-gray-200"
      >
        <Progress.Indicator className="transition-width block bg-[#F59E0B] duration-500" />
      </Progress.Track>
    </Progress.Root>
  );
}
