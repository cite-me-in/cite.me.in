import { createContext, useContext } from "react";

type EmailLinkContextValue = { email: string; token: string } | null;

export const EmailLinkContext = createContext<EmailLinkContextValue>(null);

export function useEmailLinkContext() {
  return useContext(EmailLinkContext);
}
