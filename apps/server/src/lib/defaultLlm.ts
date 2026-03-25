import { env } from "../env.ts";
import { OpenaiCompatibleChatCompletion } from "./llm/openaiCompatibleChatCompletion.ts";

/** Application default LLM client (env-backed). */
export const defaultLlm = new OpenaiCompatibleChatCompletion({
  baseUrl: env.LLM_API_BASE_URL,
  apiKey: env.LLM_API_KEY,
  model: env.LLM_MODEL,
  ...(env.LLM_HTTP_REFERER !== undefined && {
    httpReferer: env.LLM_HTTP_REFERER,
  }),
  ...(env.LLM_APP_NAME !== undefined && { appName: env.LLM_APP_NAME }),
});
