import { createCookie } from "react-router";
import envVars from "~/lib/envVars.server";

export const sessionCookie = createCookie("session", {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 180, // 180 days
  secrets: [envVars.SESSION_SECRET],
});

export const utmCookie = createCookie("utm", {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
