import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  applyAttachmentSelection,
  clearAllAttachments,
  type PendingAttachment,
  removeAttachment,
  revokeAttachmentPreviews,
} from "./attachments.ts";

export function useAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentHint, setAttachmentHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;

  useEffect(() => {
    const attachmentsRef = pendingAttachmentsRef;
    return () => {
      revokeAttachmentPreviews(attachmentsRef.current);
    };
  }, []);

  return {
    pendingAttachments,
    attachmentHint,
    setAttachmentHint,
    fileInputRef,
    onAttachmentFilesSelected: (e: ChangeEvent<HTMLInputElement>) => {
      applyAttachmentSelection(e.target, setAttachmentHint, setPendingAttachments);
    },
    removePendingAttachment: (id: string) => {
      removeAttachment(id, setPendingAttachments);
    },
    clearAttachments: () => {
      clearAllAttachments(setPendingAttachments);
    },
  };
}

export type Attachments = ReturnType<typeof useAttachments>;
