import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
  prerender: async () => [],
  ssr: true,
  ...(process.env.VITE_TEST_MODE
    ? { routeDiscovery: { mode: "initial" } as const }
    : {}),
} satisfies Config;
