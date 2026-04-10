import { createZhipu } from "zhipu-ai-provider";
import envVars from "../envVars.server";

export const glm = createZhipu({ apiKey: envVars.ZHIPU_API_KEY })("glm-4.7");
