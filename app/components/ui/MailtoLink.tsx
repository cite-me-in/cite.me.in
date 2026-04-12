import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { twMerge } from "tailwind-merge";

const mailtoLinkVariants = cva(
  "whitespace-nowrap transition-all duration-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "text-blue-500 hover:underline underline-offset-4 !p-0",
        silent: "hover:text-blue-500 hover:underline underline-offset-4 !p-0",
        button:
          "rounded-base border-2 border-black bg-[hsl(120,100%,97%)] text-black shadow-[3px_3px_0px_0px_black] hover:shadow-[5px_5px_0px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black] py-2 px-4",
        highlight: "font-medium text-black text-xl hover:text-[#F59E0B] !p-0",
        footer: "font-medium transition-colors hover:text-[#F59E0B]",
      },
      size: {
        default: "text-base",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg px-6 py-3",
        xl: "text-xl px-8 py-4",
      },
      bg: {
        yellow: "bg-[#F59E0B]",
        white: "bg-white",
        blue: "bg-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      bg: null,
    },
  },
);

interface MailtoLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof mailtoLinkVariants> {
  email: string;
  subject?: string;
  children: React.ReactNode;
}

export default function MailtoLink({
  email,
  subject,
  className,
  variant,
  size,
  bg,
  children,
  ...props
}: MailtoLinkProps) {
  const ref = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      const params = subject ? `?subject=${encodeURIComponent(subject)}` : "";
      ref.current.href = `mailto:${email}${params}`;
    }
  }, [email, subject]);

  return (
    <a
      ref={ref}
      href="mailto:"
      rel="noopener noreferer"
      className={twMerge(mailtoLinkVariants({ variant, size, bg, className }))}
      {...props}
    >
      {children}
    </a>
  );
}
