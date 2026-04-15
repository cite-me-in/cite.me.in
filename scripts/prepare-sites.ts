#!/usr/bin/env infisical --env prod run -- tsx

/**
 * This is used to prepare the sites for the digest email.
 *
 * Usage:
 *   infisical --env prod run -- tsx scripts/prepare-sites.ts
 *   infisical --env prod run -- tsx scripts/prepare-sites.ts <domain>
 */

import debug from "debug";
import prepareSites from "../app/lib/prepareSites.server";

debug.enable("server");

const domain = process.argv[2];
const sites = await prepareSites({
  domain,
  maxSites: 25,
  log: async (line) => console.info(line),
});
console.info("Prepared sites:", sites);
