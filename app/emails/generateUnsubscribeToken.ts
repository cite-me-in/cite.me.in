import { createHmac } from "node:crypto";
import envVars from "~/lib/envVars";

/**
 * Generate a unsubscribe token for the given email address.
 *
 * @param email - The email address to generate a token for.
 * @returns The unsubscribe token.
 */
export default function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", envVars.SESSION_SECRET ?? "")
    .update(email)
    .digest("hex");
}
