import { useRender } from "@base-ui/react";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { twMerge } from "tailwind-merge";

const variants = cva(
  "flex h-12 w-full rounded-base border-2 border-black bg-white px-4 py-3 font-medium text-base text-black shadow-[2px_2px_0px_0px_black] transition-all duration-100 file:border-0 file:bg-transparent file:font-medium file:text-black placeholder:text-gray-600 focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] focus-visible:shadow-[4px_4px_0px_0px_black] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-black bg-white",
        ghost:
          "border-transparent bg-transparent px-2 py-1 text-base shadow-none hover:border-border focus-visible:translate-x-0 focus-visible:translate-y-0 focus-visible:border-border focus-visible:shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & VariantProps<typeof variants>
>(({ className, type, variant, ...props }, ref) =>
  useRender({
    defaultTagName: "input",
    state: {},
    props: {
      ...props,
      type,
      className: twMerge(variants({ variant, className })),
      ref,
    },
  }),
);

Input.displayName = "Input";
export { Input };
