import { Link as EmailLink } from "@react-email/components";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type LinkProps = React.ComponentProps<typeof EmailLink>;

export default function Link({ href, ...props }: LinkProps) {
  const ctx = useEmailLinkContext();
  const pathname = href?.startsWith(envVars.VITE_APP_URL)
    ? href.slice(envVars.VITE_APP_URL.length)
    : href?.startsWith("/")
      ? href
      : null;
  const wrappedHref =
    ctx && pathname
      ? (() => {
          const url = new URL("/r", envVars.VITE_APP_URL);
          url.searchParams.set("url", pathname);
          url.searchParams.set("email", ctx.email);
          url.searchParams.set("token", ctx.token);
          return url.toString();
        })()
      : href;
  return <EmailLink href={wrappedHref} {...props} />;
}
