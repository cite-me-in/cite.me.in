import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
  },
  prerender: async () => [],
  ssr: true,
  ...(process.env.VITE_TEST_MODE ? { routeDiscovery: { mode: "initial" } as const } : {}),
} satisfies Config;
