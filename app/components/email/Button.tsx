import { Button as EmailButton } from "@react-email/components";
import { twMerge } from "tailwind-merge";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type ButtonProps = React.ComponentProps<typeof EmailButton>;

export default function Button({ href, className, ...props }: ButtonProps) {
  const ctx = useEmailLinkContext();
  if (!ctx) return <EmailButton href={href} className={className} {...props} />;

  try {
    const { pathname } = new URL(href ?? "");
    const wrapped = new URL("/r", envVars.VITE_APP_URL);
    wrapped.searchParams.set("url", pathname);
    wrapped.searchParams.set("email", ctx.email);
    wrapped.searchParams.set("token", ctx.token);
    return (
      <EmailButton
        href={wrapped.href}
        className={twMerge(
          "rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover",
          className,
        )}
        {...props}
      />
    );
  } catch {
    return <EmailButton href={href} className={className} {...props} />;
  }
}
