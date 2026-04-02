#!/usr/bin/env tsx

import debug from "debug";
import prepareSites from "../app/lib/prepareSites.server";

debug.enable("server");
const sites = await prepareSites(25);
debug("server")("Prepared sites:", sites);
