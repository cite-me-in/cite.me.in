import { Link as EmailLink } from "react-email";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type LinkProps = React.ComponentProps<typeof EmailLink>;

export default function Link({ href, ...props }: LinkProps) {
  const ctx = useEmailLinkContext();
  if (!ctx || !href) return <EmailLink href={href} {...props} />;

  const wrapped = new URL("/r", envVars.VITE_APP_URL);
  wrapped.searchParams.set(
    "url",
    href.startsWith(envVars.VITE_APP_URL) ? `${new URL(href).pathname}${new URL(href).hash}` : href,
  );
  wrapped.searchParams.set("email", ctx.email);
  wrapped.searchParams.set("token", ctx.token);
  return <EmailLink href={wrapped.href} {...props} />;
}
