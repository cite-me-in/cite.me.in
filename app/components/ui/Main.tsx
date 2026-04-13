import { useRender } from "@base-ui/react";
import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

const variants = cva("", {
  variants: {
    variant: {
      default: "mx-auto",
      wide: "mx-auto w-full max-w-5xl space-y-6 px-6 py-12",
      prose: "prose prose-lg mx-auto py-32",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const Main = forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & VariantProps<typeof variants>
>(({ className, variant, children, ...props }, ref) =>
  useRender({
    defaultTagName: "main",
    state: {},
    props: {
      children,
      ...props,
      className: twMerge(variants({ variant, className })),
      ref,
    },
  }),
);
Main.displayName = "Main";
export default Main;
