import type { Config } from "@react-router/dev/config";

export default {
  splitRouteModules: true,
  prerender: async () => [],
  ssr: true,
  ...(process.env.VITE_TEST_MODE
    ? { routeDiscovery: { mode: "initial" } as const }
    : {}),
} satisfies Config;
