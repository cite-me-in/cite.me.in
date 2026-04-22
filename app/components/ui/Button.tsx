import { useRender } from "@base-ui/react";
import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold text-base transition-all duration-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "cursor-pointer rounded-base border-2 border-black bg-[#F59E0B] text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[5px_5px_0px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-[1px_1px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px]",
        destructive:
          "rounded-base border-2 border-black bg-red-500 text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[5px_5px_0px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-[1px_1px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px]",
        outline:
          "rounded-base border-2 border-black bg-white text-black shadow-[3px_3px_0px_0px_black] hover:bg-[hsl(60,100%,99%)] hover:shadow-[5px_5px_0px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px]",
        secondary:
          "rounded-base border-2 border-black bg-[hsl(120,100%,97%)] text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[5px_5px_0px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px]",
        ghost:
          "rounded-base border-2 border-transparent text-black hover:border-black hover:bg-white",
        link: "text-black underline underline-offset-4 hover:decoration-[#F59E0B]",
        neubrutalism: twMerge(
          "border-[0.5px] duration-200 rounded-sm bg-transparent",
          // light mode
          "shadow-[4px_4px_0px_0px_rgba(0,0,0)] active:shadow-none border-zinc-800 hover:bg-zinc-50 text-zinc-800",
          // dark mode
          "dark:border-zinc-600 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.7)] active:dark:shadow-none dark:text-zinc-50 dark:bg-zinc-950",
        ),
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-sm px-4 text-xs",
        xl: "h-16 rounded-md px-10 text-lg",
        lg: "h-14 rounded-lg px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  render?: React.ReactElement;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, render, ...props }, ref) =>
    useRender({
      defaultTagName: "button",
      render,
      state: {},
      props: {
        ...props,
        className: twMerge(buttonVariants({ variant, size, className })),
        ref,
      },
    }),
);
Button.displayName = "Button";

export { Button, buttonVariants };
