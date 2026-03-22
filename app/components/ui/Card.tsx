import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

const cardVariants = cva(
  "flex flex-col gap-6 rounded-base border-2 border-border py-6 font-base shadow-shadow",
  {
    variants: {
      variant: {
        default: "bg-secondary-background text-foreground",
        ghost: "bg-transparent border-transparent shadow-none text-foreground",
        yellow: "bg-[hsl(47,100%,95%)]",
      },
      fadeIn: {
        true: "fade-in-0 zoom-in-95 animate-in duration-300",
      },
    },
    defaultVariants: {
      variant: "default",
      fadeIn: false,
    },
  },
);

function Card({
  className,
  variant,
  fadeIn,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={twMerge(cardVariants({ variant, fadeIn }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={twMerge(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={twMerge(
        "flex items-center justify-center gap-2 font-heading text-2xl leading-none",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={twMerge("font-base text-base", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={twMerge(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={twMerge("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={twMerge(
        "flex items-center justify-between px-6 [.border-t]:pt-6",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
