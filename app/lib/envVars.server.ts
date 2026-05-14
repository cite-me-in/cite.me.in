import dotenv from "dotenv";
import env from "env-var";

dotenv.config({ path: ".env", quiet: true });
if (process.env.NODE_ENV === "test")
  dotenv.config({ path: ".env.test", override: true, quiet: true });

const envVars = {
  ANTHROPIC_API_KEY: env.get("ANTHROPIC_API_KEY").required().asString(),
  CRON_SECRET: env.get("CRON_SECRET").required(false).asString(),
  GOOGLE_GENERATIVE_AI_API_KEY: env.get("GOOGLE_GENERATIVE_AI_API_KEY").required(false).asString(),
  HEARTBEAT_CRON_PROCESS_SITES: env.get("HEARTBEAT_CRON_PROCESS_SITES").required(false).asString(),
  HEARTBEAT_CRON_WEBHOOK_RETRIES: env
    .get("HEARTBEAT_CRON_WEBHOOK_RETRIES")
    .required(false)
    .asString(),
  INDEXNOW_KEY: env.get("INDEXNOW_KEY").required(false).asString(),
  LOGTAIL_ENDPOINT: env.get("LOGTAIL_ENDPOINT").required(false).asString(),
  LOGTAIL_TOKEN: env.get("LOGTAIL_TOKEN").required(false).asString(),
  OPENAI_API_KEY: env.get("OPENAI_API_KEY").required(false).asString(),
  PERPLEXITY_API_KEY: env.get("PERPLEXITY_API_KEY").required(false).asString(),
  POSTGRES_URL_NON_POOLING: env.get("POSTGRES_URL_NON_POOLING").required().asUrlString(),
  POSTGRES_URL: env.get("POSTGRES_URL").required().asUrlString(),
  REDIS_URL: env.get("REDIS_URL").required().asUrlString(),
  RESEND_API_KEY: env.get("RESEND_API_KEY").required().asString(),
  SERPAPI_API_KEY: env.get("SERPAPI_API_KEY").required().asString(),
  SESSION_SECRET: env.get("SESSION_SECRET").required().asString(),
  STRIPE_PRICE_ANNUAL_ID: env.get("STRIPE_PRICE_ANNUAL_ID").required(false).asString(),
  STRIPE_PRICE_MONTHLY_ID: env.get("STRIPE_PRICE_MONTHLY_ID").required(false).asString(),
  STRIPE_PUBLISHABLE_KEY: env.get("STRIPE_PUBLISHABLE_KEY").required(false).asString(),
  STRIPE_SECRET_KEY: env.get("STRIPE_SECRET_KEY").required().asString(),
  STRIPE_WEBHOOK_SECRET: env.get("STRIPE_WEBHOOK_SECRET").required(false).asString(),
  TRACK_API_KEY: env.get("TRACK_API_KEY").required().asString(),
  USAGE_LIMIT_COST_USD_DAILY: env.get("USAGE_LIMIT_COST_USD_DAILY").required(false).asFloat(),
  USAGE_LIMIT_COST_USD_HOURLY: env.get("USAGE_LIMIT_COST_USD_HOURLY").required(false).asFloat(),
  USAGE_LIMIT_COST_USD_MONTHLY: env.get("USAGE_LIMIT_COST_USD_MONTHLY").required(false).asFloat(),
  USAGE_LIMIT_REQUESTS: env.get("USAGE_LIMIT_REQUESTS").required(false).asInt(),
  VITE_APP_URL: env.get("VITE_APP_URL").required().asUrlString(),
  VITE_EMAIL_FROM: env.get("VITE_EMAIL_FROM").required().asString(),
  VITE_SENTRY_DSN: env.get("VITE_SENTRY_DSN").required(false).asString(),
  ZHIPU_API_KEY: env.get("ZHIPU_API_KEY").required().asString(),
};

if (process.env.NODE_ENV === "test") {
  const verifyLocalhost = (name: string, url: string) => {
    if (new URL(url).hostname !== "localhost")
      throw new Error(`${name} must point to localhost, got: ${url}`);
  };

  try {
    verifyLocalhost("POSTGRES_URL", envVars.POSTGRES_URL);
    verifyLocalhost("POSTGRES_URL_NON_POOLING", envVars.POSTGRES_URL_NON_POOLING);
    verifyLocalhost("REDIS_URL", envVars.REDIS_URL);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export default envVars;
