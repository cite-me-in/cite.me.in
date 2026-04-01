import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/cron/process-sites", schedule: "0 13 * * *" }, // Every day at 13:00 UTC => 14:00 CET
  ],
  github: { enabled: false },
  public: false,
};
