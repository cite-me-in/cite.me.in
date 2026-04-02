import { Button as EmailButton } from "@react-email/components";
import { twMerge } from "tailwind-merge";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type ButtonProps = React.ComponentProps<typeof EmailButton>;

export default function Button({ href, className, ...props }: ButtonProps) {
  const ctx = useEmailLinkContext();
  const wrappedHref =
    ctx && href
      ? (() => {
          const url = new URL("/r", envVars.VITE_APP_URL);
          url.searchParams.set("url", href);
          url.searchParams.set("email", ctx.email);
          url.searchParams.set("token", ctx.token);
          return url.toString();
        })()
      : href;
  return (
    <EmailButton
      href={wrappedHref}
      className={twMerge(
        "rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover",
        className,
      )}
      {...props}
    />
  );
}
