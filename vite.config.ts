import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { type UserConfig, defineConfig, mergeConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(async (config) =>
  mergeConfig(config, {
    build: {
      sourcemap: true,
    },
    resolve: {
      dedupe: ["react", "react-dom", "react-router"],
    },
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    ssr: {
      noExternal: [
        // NOTE: recommended by the Streamdown docs
        // @see https://streamdown.ai/docs/faq#why-do-i-get-a-css-loading-error-when-using-streamdown-with-vite-ssr
        "streamdown",
      ],
    },
    server: {
      allowedHosts: [".ngrok-free.app"],
    },
  } satisfies UserConfig),
);
