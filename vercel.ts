import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/cron/citation-runs", schedule: "0 6 * * *" },
    { path: "/cron/bot-insights", schedule: "0 12 * * *" },
    { path: "/cron/weekly-digest", schedule: "0 9 * * 1" },
  ],
  github: { enabled: false },
  public: false,
};
