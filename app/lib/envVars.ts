import dotenv from "dotenv";
import env from "env-var";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  override: true,
  quiet: true,
});

const envVars = {
  ANTHROPIC_API_KEY: env.get("ANTHROPIC_API_KEY").required(false).asString(),
  CRON_SECRET: env.get("CRON_SECRET").required(false).asString(),
  APP_URL: env
    .get("APP_URL")
    .default("https://citeup.vercel.app")
    .asUrlString(),
  DATABASE_URL: env.get("DATABASE_URL").required().asUrlString(),
  EMAIL_FROM: env.get("EMAIL_FROM").default("noreply@citeup.com").asString(),
  GOOGLE_GENERATIVE_AI_API_KEY: env
    .get("GOOGLE_GENERATIVE_AI_API_KEY")
    .required(false)
    .asString(),
  OPENAI_API_KEY: env.get("OPENAI_API_KEY").required(false).asString(),
  PERPLEXITY_API_KEY: env.get("PERPLEXITY_API_KEY").required(false).asString(),
  RESEND_API_KEY: env.get("RESEND_API_KEY").required(false).asString(),
  SESSION_SECRET: env.get("SESSION_SECRET").required().asString(),
};

export default envVars;
