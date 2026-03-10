export type BotTrackerConfig = {
  apiKey: string;
  endpoint: string;
};

export type BotTrackPayload = {
  url: string;
  userAgent?: string | null;
  accept?: string | null;
  ip?: string | null;
  referer?: string | null;
};

export type BotTracker = {
  track: (payload: BotTrackPayload) => void;
};

export function createBotTracker({
  apiKey,
  endpoint,
}: BotTrackerConfig): BotTracker {
  return {
    track({ url, userAgent, accept, ip, referer }) {
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ url, userAgent, accept, ip, referer }),
      }).catch(() => {});
    },
  };
}
