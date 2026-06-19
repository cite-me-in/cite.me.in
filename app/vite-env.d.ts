// CSS side-effect imports (non-module)
declare module "*.css" {}

// Raw content imports (e.g. *.md?raw, *.txt?raw)
declare module "*?raw" {
  const src: string;
  export default src;
}

// Markdown imports (non-raw, e.g. for-ai-assistants.md)
declare module "*.md" {
  const src: string;
  export default src;
}

// Vite import.meta.env (PROD, DEV, MODE, BASE_URL, SSR)
interface ImportMetaEnv {
  DEV: boolean;
  MODE: string;
  PROD: boolean;
  VITE_APP_URL: string;
  VITE_EMAIL_FROM: string;
  VITE_SENTRY_DSN: string;
  VITE_TEST_MODE: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
