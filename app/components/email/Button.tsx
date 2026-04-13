import { Button as EmailButton } from "@react-email/components";
import { twMerge } from "tailwind-merge";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type ButtonProps = React.ComponentProps<typeof EmailButton>;

export default function Button({ href, className, ...props }: ButtonProps) {
  const ctx = useEmailLinkContext();
  if (!ctx || !href) return <EmailButton className={className} {...props} />;

  const wrapped = new URL("/r", envVars.VITE_APP_URL);
  wrapped.searchParams.set(
    "url",
    href.startsWith(envVars.VITE_APP_URL) ? new URL(href).pathname : href,
  );
  wrapped.searchParams.set("email", ctx.email);
  wrapped.searchParams.set("token", ctx.token);
  return (
    <EmailButton
      href={wrapped.href}
      className={twMerge(
        "rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-hover",
        className,
      )}
      {...props}
    />
  );
}
