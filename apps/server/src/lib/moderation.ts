import { env } from "../env.ts";

/**
 * Screens user messages with OpenAI's free moderation endpoint before they
 * reach the agent.
 *
 * Self-harm signals take priority over every other category and route to a
 * campus-resources response rather than a refusal. Anything else above its
 * threshold gets a short refusal.
 */

export type ModerationAction = "allow" | "refuse" | "selfHarm";

export interface ModerationVerdict {
  action: ModerationAction;
  /** Category ids that crossed their threshold, for logging. */
  flaggedCategories: string[];
}

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";
const TIMEOUT_MS = 4000;

/** Score thresholds (0..1) per category id as returned by the endpoint.
 *  Self-harm categories route to support resources instead of a refusal. */
const SELF_HARM_THRESHOLDS: Record<string, number> = {
  "self-harm": 0.5,
  "self-harm/intent": 0.4,
  "self-harm/instructions": 0.4,
};

const REFUSE_THRESHOLDS: Record<string, number> = {
  "sexual/minors": 0.2,
  sexual: 0.85,
  "hate/threatening": 0.5,
  "harassment/threatening": 0.6,
  "illicit/violent": 0.7,
  "violence/graphic": 0.85,
};

export const SELF_HARM_RESPONSE =
  `It sounds like you might be going through something really difficult right now. You don't have to handle it alone, and support is available on campus whenever you're ready.

- **CMU Counseling and Psychological Services (CaPS)**: 412-268-2922, available 24/7
- **988 Suicide and Crisis Lifeline**: call or text 988, available 24/7
- **If you are in immediate danger**: call 911, or CMU Police at 412-268-2323

If it would help, I can also point you to other campus support resources.`;

export const REFUSAL_RESPONSE =
  "I can't help with that. If you have a question about campus, like courses, dining, or getting around CMU, I'm happy to help.";

export function responseForModeration(action: ModerationAction): string {
  return action === "selfHarm" ? SELF_HARM_RESPONSE : REFUSAL_RESPONSE;
}

function exceeded(
  scores: Record<string, number>,
  thresholds: Record<string, number>,
): string[] {
  return Object.entries(thresholds)
    .filter(([category, threshold]) => (scores[category] ?? 0) >= threshold)
    .map(([category]) => category);
}

function isScoreRecord(v: unknown): v is Record<string, number> {
  return typeof v === "object" && v !== null;
}

function extractScores(raw: unknown): Record<string, number> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return undefined;
  const scores = (results[0] as { category_scores?: unknown }).category_scores;
  return isScoreRecord(scores) ? scores : undefined;
}

const ALLOW: ModerationVerdict = { action: "allow", flaggedCategories: [] };

export async function moderateUserMessage(
  text: string,
): Promise<ModerationVerdict> {
  const apiKey = env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return ALLOW;
  }
  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `moderation: OpenAI returned ${res.status}, allowing message`,
      );
      return ALLOW;
    }
    const scores = extractScores(await res.json());
    if (scores === undefined) {
      console.warn("moderation: unexpected response shape, allowing message");
      return ALLOW;
    }
    const selfHarm = exceeded(scores, SELF_HARM_THRESHOLDS);
    if (selfHarm.length > 0) {
      return { action: "selfHarm", flaggedCategories: selfHarm };
    }
    const refuse = exceeded(scores, REFUSE_THRESHOLDS);
    if (refuse.length > 0) {
      return { action: "refuse", flaggedCategories: refuse };
    }
    return ALLOW;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`moderation: check failed (${msg}), allowing message`);
    return ALLOW;
  }
}
