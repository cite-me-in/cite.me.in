import * as React from "react";
import { twMerge } from "tailwind-merge";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={twMerge(
      "flex min-h-[80px] w-full rounded-base border-2 border-black bg-white px-4 py-3 font-medium text-base text-black shadow-[2px_2px_0px_0px_black] transition-all duration-100 placeholder:text-gray-600 focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] focus-visible:shadow-[4px_4px_0px_0px_black] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
