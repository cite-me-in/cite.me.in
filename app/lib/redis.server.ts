import Redis from "ioredis";
import envVars from "./envVars";

const redis = new Redis(envVars.REDIS_URL);
export default redis;
