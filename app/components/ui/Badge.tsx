import { useRender } from "@base-ui/react";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-base w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-main text-main-foreground",
        neutral: "text-foreground bg-neutral-100 border-neutral-200",
        yellow: "bg-amber-400 text-black",
        green: "border-green-600 bg-green-500 text-white",
        red: "border-red-600 bg-red-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  render,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    render?: React.ReactElement;
  }) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      ...props,
      "data-slot": "badge",
      className: twMerge(badgeVariants({ variant }), className),
    },
  });
}

export { Badge, badgeVariants };
