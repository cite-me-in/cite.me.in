import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

const alertVariants = cva(
  "relative w-full rounded-base border-2 border-border px-4 py-3 text-base grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current shadow-shadow",
  {
    variants: {
      variant: {
        default: "bg-main text-main-foreground",
        destructive: "bg-destructive text-white",
        outline: "text-destructive border-0 shadow-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={twMerge(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={twMerge(
        "col-start-2 line-clamp-1 min-h-4 font-heading tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={twMerge(
        "col-start-2 grid justify-items-start gap-1 font-base text-base [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
