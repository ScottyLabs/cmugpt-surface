import { fileExtension } from "../attachments.ts";
import type { ChatShellController } from "../useChatShell.ts";
import { Composer } from "./Composer.tsx";

const FILE_ACCEPT =
  "image/*,text/*,.md,.json,.csv,.ts,.tsx,.jsx,.js,.mjs,.cjs,.yml,.yaml,.toml,.xml,.html,.htm,.css,.rs,.go,.java,.kt,.swift,.py,.rb,.php,.sh,.env,application/json";

function AttachmentsBar({ c }: { c: ChatShellController }) {
  const { attachments } = c;
  return (
    <div className="mx-auto max-w-3xl">
      {attachments.pendingAttachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {attachments.pendingAttachments.map((p) => (
            <li
              key={p.id}
              className="flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-0.5 pr-1 text-xs text-neutral-700"
            >
              {p.previewUrl !== undefined && p.previewUrl !== "" ? (
                <img
                  src={p.previewUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-600">
                  {fileExtension(p.file.name).slice(0, 3) || "file"}
                </span>
              )}
              <span className="max-w-[140px] truncate sm:max-w-[200px]">{p.file.name}</span>
              <button
                type="button"
                onClick={() => {
                  attachments.removePendingAttachment(p.id);
                }}
                className="shrink-0 rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                aria-label={`Remove ${p.file.name}`}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}
      {attachments.attachmentHint !== null && attachments.attachmentHint !== "" && (
        <p className="mb-2 text-center text-xs text-red-600">{attachments.attachmentHint}</p>
      )}
    </div>
  );
}

export function ComposerFooter({ c }: { c: ChatShellController }) {
  const { attachments, derived, session, stream } = c;
  return (
    <div className=" bg-white px-4 pb-5 pt-3">
      <input
        ref={attachments.fileInputRef}
        type="file"
        className="sr-only"
        accept={FILE_ACCEPT}
        multiple
        onChange={attachments.onAttachmentFilesSelected}
      />
      <AttachmentsBar c={c} />
      {(derived.shouldShowConversation || session.chatsLoading || session.isNewChatIntent) && (
        <>
          <div className="mx-auto flex max-w-3xl flex-col gap-[0.625rem] rounded-[1.875rem] border-0 bg-white px-6 py-4 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
            <Composer
              c={c}
              rowClassName="flex items-end gap-1 sm:gap-2"
              textareaClassName="max-h-40 min-h-[7.625rem] flex-1 resize-none bg-transparent py-2 text-sm leading-snug text-neutral-900 outline-none placeholder:text-fg-neutral-secondary placeholder:font-normal disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-center font-medium text-fg-neutral-tertiary pt-4">
            CMUGPT is AI and can make mistakes. Please double-check responses.
          </p>
          {stream.streamError !== null && stream.streamError !== "" && (
            <p className="mx-auto mt-2 max-w-3xl text-center text-red-600 text-xs">
              {stream.streamError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
