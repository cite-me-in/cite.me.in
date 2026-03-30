import Redis from "ioredis";
import envVars from "./envVars.server";

export default new Redis(envVars.REDIS_URL);
