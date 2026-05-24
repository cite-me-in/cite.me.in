import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

function DialogRoot({ ...props }: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof Dialog.Portal>) {
  return <Dialog.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog.Backdrop>, "className"> & {
  className?: string;
}) {
  return (
    <Dialog.Backdrop
      data-slot="dialog-overlay"
      className={twMerge(
        "fixed inset-0 z-50 bg-overlay transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Dialog.Popup>, "className"> & {
  className?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <Dialog.Popup
        data-slot="dialog-content"
        className={twMerge(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-base border-2 border-border bg-background p-6 shadow-shadow transition-all duration-200 data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0 sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="rounded-base absolute top-4 right-4 opacity-100 ring-offset-white focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={twMerge(
        "flex flex-col gap-2 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={twMerge(
        "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog.Title>, "className"> & {
  className?: string;
}) {
  return (
    <Dialog.Title
      data-slot="dialog-title"
      className={twMerge(
        "font-heading text-lg leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog.Description>, "className"> & {
  className?: string;
}) {
  return (
    <Dialog.Description
      data-slot="dialog-description"
      className={twMerge("font-base text-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  DialogRoot as Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
