import type { SendCtx } from "./sendMessage.ts";

type StopCtx = Pick<SendCtx, "refetchMessages" | "refetchChats" | "setOptimisticUserMessage">;

/** What the client saw of one turn, so a stopped turn can find its saved reply. */
export interface StreamTurn {
  userMessageId: string | null;
  receivedText: boolean;
}

const SAVED_REPLY_RETRY_DELAYS_MS = [250, 500, 1_000];

/** Refetches until the reply to `userMessageId` is in the list, or retries run out. */
async function refetchUntilReplySaved(
  ctx: StopCtx,
  userMessageId: string,
  attempt = 0,
): Promise<void> {
  const { data = [] } = await ctx.refetchMessages();
  const userIndex = data.findIndex((m) => m.id === userMessageId);
  const delay = SAVED_REPLY_RETRY_DELAYS_MS[attempt];
  if ((userIndex !== -1 && userIndex < data.length - 1) || delay === undefined) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
  await refetchUntilReplySaved(ctx, userMessageId, attempt + 1);
}

/** The server saves a stopped reply's partial text once it sees the
 *  disconnect, which can land after the client's first refetch. The live text
 *  stays on screen until the saved copy is loaded, so it never blanks out. */
export async function settleStoppedTurn(ctx: StopCtx, turn: StreamTurn): Promise<void> {
  if (turn.userMessageId !== null && turn.receivedText) {
    await refetchUntilReplySaved(ctx, turn.userMessageId);
  } else {
    await ctx.refetchMessages();
  }
  // The refetch above shows the question if the server saved it; a very early Stop may have reached the server first, so the local copy must not linger.
  ctx.setOptimisticUserMessage(null);
  void ctx.refetchChats();
}
