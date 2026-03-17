import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/cron/process-sites", schedule: "0 */4 * * *" }, // Every 4 hours
  ],
  github: { enabled: false },
  public: false,
};
