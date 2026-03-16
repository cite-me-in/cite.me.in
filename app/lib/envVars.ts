import dotenv from "dotenv";
import env from "env-var";

dotenv.config({ quiet: true });

const envVars = {
  ADMIN_API_SECRET: env.get("ADMIN_API_SECRET").required(false).asString(),
  ANTHROPIC_API_KEY: env.get("ANTHROPIC_API_KEY").required().asString(),
  BOT_TRACKER_API_KEY: env.get("BOT_TRACKER_API_KEY").required().asString(),
  BOT_TRACKER_URL: env.get("BOT_TRACKER_URL").required().asUrlString(),
  CRON_SECRET: env.get("CRON_SECRET").required(false).asString(),
  GOOGLE_GENERATIVE_AI_API_KEY: env
    .get("GOOGLE_GENERATIVE_AI_API_KEY")
    .required(false)
    .asString(),
  LOGTAIL_ENDPOINT: env.get("LOGTAIL_ENDPOINT").required(false).asUrlString(),
  LOGTAIL_TOKEN: env.get("LOGTAIL_TOKEN").required(false).asString(),
  OPENAI_API_KEY: env.get("OPENAI_API_KEY").required(false).asString(),
  PERPLEXITY_API_KEY: env.get("PERPLEXITY_API_KEY").required(false).asString(),
  POSTGRES_URL: env.get("POSTGRES_URL").required().asUrlString(),
  POSTGRES_URL_NON_POOLING: env
    .get("POSTGRES_URL_NON_POOLING")
    .required()
    .asUrlString(),
  REDIS_URL: env.get("REDIS_URL").required().asString(),
  RESEND_API_KEY: env.get("RESEND_API_KEY").required().asString(),
  SESSION_SECRET: env.get("SESSION_SECRET").required().asString(),
  VITE_APP_URL: env.get("VITE_APP_URL").required().asUrlString(),
  VITE_EMAIL_FROM: env.get("VITE_EMAIL_FROM").required().asString(),

  USAGE_LIMIT_COST_USD_HOURLY: env
    .get("USAGE_LIMIT_COST_USD_HOURLY")
    .required(false)
    .asFloat(),
  USAGE_LIMIT_COST_USD_DAILY: env
    .get("USAGE_LIMIT_COST_USD_DAILY")
    .required(false)
    .asFloat(),
  USAGE_LIMIT_COST_USD_MONTHLY: env
    .get("USAGE_LIMIT_COST_USD_MONTHLY")
    .required(false)
    .asFloat(),
  USAGE_LIMIT_REQUESTS: env.get("USAGE_LIMIT_REQUESTS").required(false).asInt(),

  HEARTBEAT_CRON_CITATIONS: env
    .get("HEARTBEAT_CRON_CITATIONS")
    .required(false)
    .asString(),
  HEARTBEAT_CRON_BOT_INSIGHTS: env
    .get("HEARTBEAT_CRON_BOT_INSIGHTS")
    .required(false)
    .asString(),
  HEARTBEAT_CRON_WEEKLY_DIGEST: env
    .get("HEARTBEAT_CRON_WEEKLY_DIGEST")
    .required(false)
    .asString(),
};

export default envVars;
