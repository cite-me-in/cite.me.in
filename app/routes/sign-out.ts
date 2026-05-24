import { redirect } from "react-router";

import { signOut } from "~/lib/auth.server";

export async function loader() {
  const headers = await signOut();
  throw redirect("/", { headers });
}
