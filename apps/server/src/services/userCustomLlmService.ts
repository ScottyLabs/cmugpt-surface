import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { userCustomLlm } from "../db/schema.ts";
import { env } from "../env.ts";
import { defaultLlm } from "../lib/defaultLlm.ts";
import { OpenaiCompatibleChatCompletion } from "../lib/llm/openaiCompatibleChatCompletion.ts";
import { BadRequestError } from "../middlewares/errorHandler.ts";

export interface CustomLlmSettingsDto {
  useCustomChat: boolean;
  baseUrl: string;
  model: string;
  /** True when a non-empty API key is stored (value is never returned). */
  apiKeySet: boolean;
}

export interface PatchCustomLlmBody {
  useCustomChat?: boolean;
  baseUrl?: string;
  model?: string;
  /** Omit to leave the stored key unchanged. */
  apiKey?: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const userCustomLlmService = {
  async getSettings(userSub: string): Promise<CustomLlmSettingsDto> {
    const [row] = await db
      .select()
      .from(userCustomLlm)
      .where(eq(userCustomLlm.userSub, userSub))
      .limit(1);

    const baseUrl =
      row != null && row.baseUrl.trim() !== ""
        ? row.baseUrl.trim()
        : env.LLM_API_BASE_URL;
    const model =
      row != null && row.model.trim() !== "" ? row.model.trim() : env.LLM_MODEL;

    return {
      useCustomChat: row?.useCustomChat ?? false,
      baseUrl,
      model,
      apiKeySet: Boolean(row?.apiKey?.trim()),
    };
  },

  async patchSettings(
    userSub: string,
    body: PatchCustomLlmBody,
  ): Promise<CustomLlmSettingsDto> {
    const [existing] = await db
      .select()
      .from(userCustomLlm)
      .where(eq(userCustomLlm.userSub, userSub))
      .limit(1);

    const useCustomChat =
      body.useCustomChat ?? existing?.useCustomChat ?? false;

    let baseUrl: string;
    if (body.baseUrl !== undefined) {
      baseUrl = body.baseUrl.trim();
    } else if (existing?.baseUrl?.trim()) {
      baseUrl = existing.baseUrl.trim();
    } else {
      baseUrl = env.LLM_API_BASE_URL;
    }

    let model: string;
    if (body.model !== undefined) {
      model = body.model.trim();
    } else if (existing?.model?.trim()) {
      model = existing.model.trim();
    } else {
      model = env.LLM_MODEL;
    }

    let apiKey: string;
    if (body.apiKey !== undefined) {
      apiKey = body.apiKey.trim();
    } else {
      apiKey = existing?.apiKey?.trim() ?? "";
    }

    if (useCustomChat) {
      if (!isValidHttpUrl(baseUrl)) {
        throw new BadRequestError("baseUrl must be a valid http(s) URL");
      }
      if (!model) {
        throw new BadRequestError(
          "model is required when custom chat is enabled",
        );
      }
      if (!apiKey) {
        throw new BadRequestError(
          "apiKey is required when custom chat is enabled (or was never saved)",
        );
      }
    }

    await db
      .insert(userCustomLlm)
      .values({
        userSub,
        useCustomChat,
        baseUrl,
        apiKey,
        model,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userCustomLlm.userSub,
        set: {
          useCustomChat,
          baseUrl,
          apiKey,
          model,
          updatedAt: new Date(),
        },
      });

    return userCustomLlmService.getSettings(userSub);
  },

  /** Resolves the LLM client for chat completions (streaming and non-streaming). */
  async getChatCompletionForUser(
    userSub: string,
  ): Promise<OpenaiCompatibleChatCompletion> {
    const [row] = await db
      .select()
      .from(userCustomLlm)
      .where(eq(userCustomLlm.userSub, userSub))
      .limit(1);

    if (
      row?.useCustomChat &&
      row.baseUrl?.trim() &&
      row.apiKey?.trim() &&
      row.model?.trim()
    ) {
      return new OpenaiCompatibleChatCompletion({
        baseUrl: row.baseUrl.trim(),
        apiKey: row.apiKey.trim(),
        model: row.model.trim(),
        ...(env.LLM_HTTP_REFERER !== undefined && {
          httpReferer: env.LLM_HTTP_REFERER,
        }),
        ...(env.LLM_APP_NAME !== undefined && { appName: env.LLM_APP_NAME }),
      });
    }

    return defaultLlm;
  },
};
