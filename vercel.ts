import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/cron/process-sites", schedule: "0 * * * *" }, // Every hour, at minute 0
  ],
  github: { enabled: false },
  public: false,
};
