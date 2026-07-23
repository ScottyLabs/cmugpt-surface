import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { userPreferences } from "../db/schema.ts";
import { DEFAULT_MODEL_ID, isValidModelId } from "../lib/models.ts";
import { BadRequestError } from "../middlewares/errorHandler.ts";

export interface UserPreferencesDto {
  preferredModel: string;
}

export const userPreferencesService = {
  /** Read the user's preferences. Returns the default model if no row exists. */
  async get(userSub: string): Promise<UserPreferencesDto> {
    const [row] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userSub, userSub))
      .limit(1);
    return {
      preferredModel: row?.preferredModel ?? DEFAULT_MODEL_ID,
    };
  },

  /** Look up the user's preferred model with a sane fallback. */
  async getPreferredModel(userSub: string): Promise<string> {
    const prefs = await this.get(userSub);
    return prefs.preferredModel;
  },

  /** Upsert the user's preferences. Validates the model against the curated list. */
  async update(userSub: string, body: { preferredModel?: string }): Promise<UserPreferencesDto> {
    const { preferredModel } = body;
    if (preferredModel === undefined) {
      throw new BadRequestError("preferredModel is required");
    }
    if (!isValidModelId(preferredModel)) {
      throw new BadRequestError(
        `Unknown model id: ${preferredModel}. Use one of the values from GET /me/models.`,
      );
    }
    const [row] = await db
      .insert(userPreferences)
      .values({
        userSub,
        preferredModel,
      })
      .onConflictDoUpdate({
        target: userPreferences.userSub,
        set: {
          preferredModel,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    if (row === undefined) {
      throw new Error("Failed to upsert user preferences");
    }
    return { preferredModel: row.preferredModel };
  },
};
