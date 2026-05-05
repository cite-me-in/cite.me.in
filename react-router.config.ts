import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
  },
  prerender: async () => [],
  ssr: true,
} satisfies Config;
