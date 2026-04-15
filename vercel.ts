import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "react-router",
  crons: [
    { path: "/cron/webhook-retries", schedule: "*/5 * * * *" }, // Every 5 minute
    { path: "/cron/process-sites", schedule: "0 * * * *" }, // Every hour, at minute 0
    { path: "/cron/check-cited-pages", schedule: "0 5 * * *" }, // Every day, at 5:00 AM
  ],
  github: { enabled: false },
  public: false,
};
