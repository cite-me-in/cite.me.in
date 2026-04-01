#!/usr/bin/env tsx

import debug from "debug";
import prepareSites from "../app/routes/prepareSites.server";

debug.enable("server");
const sites = await prepareSites();
debug("server")("Prepared sites:", sites);
