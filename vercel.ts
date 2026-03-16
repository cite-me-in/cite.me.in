import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/cron/citation-runs", schedule: "0 13 * * *" }, // 6 AM Pacific
    { path: "/cron/bot-insights", schedule: "0 14 * * *" }, // 7 AM Pacific
    { path: "/cron/weekly-digest", schedule: "0 15 * * 1" }, // 8 AM Pacific on Sunday
  ],
  github: { enabled: false },
  public: false,
};
