#!/usr/bin/env infisical --env prod run -- tsx

/**
 * This is used to prepare the sites for the digest email.
 *
 * Usage:
 *   infisical --env prod run -- tsx scripts/prepare-sites.ts
 */

import debug from "debug";
import prepareSites from "../app/lib/prepareSites.server";

debug.enable("server");
const sites = await prepareSites({ maxSites: 25 });
debug("server")("Prepared sites:", sites);
