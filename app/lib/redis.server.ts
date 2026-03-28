import Redis from "ioredis";
import envVars from "./envVars";

export default new Redis(envVars.REDIS_URL);
