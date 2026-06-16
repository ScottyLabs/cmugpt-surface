import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { env } from "@/env.ts";
import { $api } from "@/lib/api/client.ts";
import type {
  ChatStreamEvent,
  CmuMapsPayload,
  PendingAttachment,
} from "@/lib/chatUtils.ts";
import {
  buildOutgoingContent,
  MAX_ATTACHMENTS,
  NO_CHAT,
  STICKY_SCROLL_THRESHOLD_PX,
} from "@/lib/chatUtils.ts";
import { ChatComposer } from "./ChatComposer.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
import { ChatMessages } from "./ChatMessages.tsx";
import { ChatModal } from "./ChatModal.tsx";
import { ChatSidebar } from "./ChatSidebar.tsx";
import { SearchPanel } from "./SearchPanel.tsx";
import { SidebarContextMenu } from "./SidebarContextMenu.tsx";

const routeApi = getRouteApi("/");

export function ChatShell() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const chatId = search.chat;
  const isNewChatIntent = search.newChat;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingCmuMaps, setStreamingCmuMaps] =
    useState<CmuMapsPayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<{
    chatId: string;
    content: string;
    messageCountBeforeSend: number;
  } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentHint, setAttachmentHint] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<
    null | "copied" | "shared"
  >(null);
  const [sidebarMenu, setSidebarMenu] = useState<{
    x: number;
    y: number;
    chatId: string;
  } | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"settings" | "about" | null>(
    null,
  );
  const [mapsIsDisabled, setMapsIsDisabled] = useState(false);
  const [eatsIsDisabled, setEatsIsDisabled] = useState(false);
  const [coursesIsDisabled, setCoursesIsDisabled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("Auto-detect");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const draftComposerRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoFocusedComposerRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const streamFlushResolversRef = useRef<Array<() => void>>([]);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const shareFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  pendingAttachmentsRef.current = pendingAttachments;

  function resolveStreamFlushWaiters() {
    const resolvers = streamFlushResolversRef.current.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  function cancelStreamFlushFrame() {
    if (streamFrameRef.current !== null) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
  }

  function flushStreamingText() {
    streamFrameRef.current = null;
    const next = streamBufferRef.current;
    streamBufferRef.current = "";
    if (next) {
      setStreamingText((current) => current + next);
    }
    resolveStreamFlushWaiters();
  }

  function enqueueStreamingText(text: string) {
    if (!text) return;
    streamBufferRef.current += text;
    if (streamFrameRef.current === null) {
      streamFrameRef.current = requestAnimationFrame(flushStreamingText);
    }
  }

  function waitForStreamingFlush(): Promise<void> {
    if (!streamBufferRef.current && streamFrameRef.current === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      streamFlushResolversRef.current.push(resolve);
    });
  }

  function resetStreamingBuffer() {
    streamBufferRef.current = "";
    cancelStreamFlushFrame();
    resolveStreamFlushWaiters();
    setStreamingText("");
    setStreamStatus(null);
    setStreamingCmuMaps(null);
  }

  useEffect(() => {
    return () => {
      for (const p of pendingAttachmentsRef.current) {
        if (p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      }
      if (shareFeedbackTimerRef.current) {
        clearTimeout(shareFeedbackTimerRef.current);
      }
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      const resolvers = streamFlushResolversRef.current.splice(0);
      for (const resolve of resolvers) {
        resolve();
      }
    };
  }, []);

  const searchChatsQueryInit = useMemo(() => {
    const q = searchQ.trim();
    if (!q) return undefined;
    return { params: { query: { q } } } as const;
  }, [searchQ]);

  const {
    data: chats = [],
    refetch: refetchChats,
    isLoading: chatsLoading,
  } = $api.useQuery("get", "/chats", undefined);

  const { data: searchChats = [], isLoading: searchChatsLoading } =
    $api.useQuery("get", "/chats", searchChatsQueryInit, {
      enabled: Boolean(searchQ.trim()),
    });

  const {
    data: messages = [],
    refetch: refetchMessages,
    isLoading: messagesLoading,
  } = $api.useQuery(
    "get",
    "/chats/{id}/messages",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  const { data: chatDetail, refetch: refetchChatDetail } = $api.useQuery(
    "get",
    "/chats/{id}",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  const lastAssistantCmuMaps = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant" && m.cmuMaps?.url) {
        return m.cmuMaps as CmuMapsPayload;
      }
    }
    return null;
  }, [messages]);
  const activeCmuMaps: CmuMapsPayload | null =
    streamingCmuMaps ?? lastAssistantCmuMaps;

  const createChat = $api.useMutation("post", "/chats", {
    onSuccess: () => {
      void refetchChats();
    },
  });

  const patchChat = $api.useMutation("patch", "/chats/{id}", {
    onSuccess: () => {
      void refetchChats();
      void refetchChatDetail();
    },
  });

  const chatIdRef = useRef<string | undefined>(chatId);
  chatIdRef.current = chatId;

  const deleteChat = $api.useMutation("delete", "/chats/{id}", {
    onSuccess: async (_data, variables) => {
      const deletedId = variables.params.path.id;
      const wasActive = chatIdRef.current === deletedId;
      const { data: nextChats } = await refetchChats();
      if (wasActive) {
        const list = nextChats ?? [];
        if (list.length > 0) {
          void navigate({
            to: "/",
            search: { chat: list[0].id, newChat: false },
          });
        } else {
          void navigate({
            to: "/",
            search: { chat: undefined, newChat: false },
          });
        }
      }
    },
  });

  const starredChats = useMemo(() => chats.filter((c) => c.starred), [chats]);
  const unstarredChats = useMemo(
    () => chats.filter((c) => !c.starred),
    [chats],
  );

  const currentChat = chats.find((c) => c.id === chatId);
  const optimisticMessageIsForVisibleChat =
    optimisticUserMessage !== null &&
    (!chatId || optimisticUserMessage.chatId === chatId);
  const optimisticMessagePersisted =
    optimisticUserMessage !== null &&
    chatId === optimisticUserMessage.chatId &&
    messages.length > optimisticUserMessage.messageCountBeforeSend;
  const shouldShowOptimisticUserMessage =
    optimisticMessageIsForVisibleChat && !optimisticMessagePersisted;
  const shouldShowConversation =
    Boolean(chatId) || shouldShowOptimisticUserMessage || isStreaming;
  const showMessagesLoading =
    Boolean(chatId) && messagesLoading && !shouldShowOptimisticUserMessage;

  useEffect(() => {
    if (optimisticMessagePersisted) {
      setOptimisticUserMessage(null);
    }
  }, [optimisticMessagePersisted]);

  const effectiveChatDetail = useMemo(() => {
    if (chatDetail) return chatDetail;
    if (currentChat && chatId && currentChat.id === chatId) {
      return { ...currentChat, isOwner: true as const };
    }
    return undefined;
  }, [chatDetail, currentChat, chatId]);

  const canEditChat = Boolean(effectiveChatDetail?.isOwner);
  const showMakePrivate = Boolean(
    effectiveChatDetail?.isOwner && effectiveChatDetail?.isPublic,
  );

  useEffect(() => {
    if (isNewChatIntent) return;
    if (!chatsLoading && chats.length > 0 && !chatId) {
      void navigate({
        to: "/",
        search: { chat: chats[0].id, newChat: false },
        replace: true,
      });
    }
  }, [chats, chatId, chatsLoading, navigate, isNewChatIntent]);

  useEffect(() => {
    if (hasAutoFocusedComposerRef.current || isStreaming) return;
    if (chatId && !canEditChat) return;
    if (!chatId && chatsLoading) return;
    if (!chatId && chats.length > 0 && !isNewChatIntent) return;
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
      hasAutoFocusedComposerRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [
    chatId,
    chatsLoading,
    chats.length,
    isStreaming,
    canEditChat,
    isNewChatIntent,
  ]);

  useEffect(() => {
    if (!isNewChatIntent) return;
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isNewChatIntent]);

  useEffect(() => {
    if (!isStreaming && messages.length === 0 && streamingText.length === 0)
      return;
    if (!shouldStickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStreaming, messages.length, streamingText.length]);

  const displayName =
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    (user?.id ? String(user.id) : "User");

  function scheduleShareFeedbackClear() {
    if (shareFeedbackTimerRef.current) {
      clearTimeout(shareFeedbackTimerRef.current);
    }
    shareFeedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
      shareFeedbackTimerRef.current = null;
    }, 2200);
  }

  async function shareChatById(targetId: string, alreadyPublic: boolean) {
    if (typeof window === "undefined") return;
    if (!alreadyPublic) {
      const ok = window.confirm(
        "Anyone signed in to cmuGPT can open this chat with the link. Make this chat public and continue sharing?",
      );
      if (!ok) return;
      try {
        await patchChat.mutateAsync({
          params: { path: { id: targetId } },
          body: { isPublic: true },
        });
      } catch {
        return;
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set("chat", targetId);
    const shareUrl = url.toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "cmuGPT",
          text: "Chat on cmuGPT",
          url: shareUrl,
        });
        setShareFeedback("shared");
        scheduleShareFeedbackClear();
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("copied");
    } catch {
      window.prompt("Copy this link to share:", shareUrl);
      setShareFeedback(null);
      return;
    }
    scheduleShareFeedbackClear();
  }

  async function shareChat() {
    if (!chatId || typeof window === "undefined") return;
    const detail = effectiveChatDetail;
    if (!detail || !detail.isOwner) return;
    await shareChatById(chatId, detail.isPublic);
  }

  function makeChatPrivate() {
    if (!chatId) return;
    patchChat.mutate({
      params: { path: { id: chatId } },
      body: { isPublic: false },
    });
  }

  function onAttachmentFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const list = input.files;
    if (list == null || list.length === 0) return;
    const files = Array.from(list);
    input.value = "";
    setAttachmentHint(null);
    let limitHint: string | null = null;
    setPendingAttachments((prev) => {
      const additions: PendingAttachment[] = [];
      for (const file of files) {
        if (prev.length + additions.length >= MAX_ATTACHMENTS) {
          limitHint = `You can attach up to ${MAX_ATTACHMENTS} files.`;
          break;
        }
        additions.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        });
      }
      return [...prev, ...additions];
    });
    if (limitHint) setAttachmentHint(limitHint);
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function selectChat(id: string) {
    void navigate({ to: "/", search: { chat: id, newChat: false } });
  }

  const closeSidebarMenu = useCallback(() => {
    setSidebarMenu(null);
  }, []);

  function beginRename(c: { id: string; title: string }) {
    setRenamingChatId(c.id);
    setRenameDraft(c.title);
    closeSidebarMenu();
  }

  function cancelRename() {
    setRenamingChatId(null);
  }

  function commitRename(id: string, originalTitle: string) {
    const t = renameDraft.trim();
    if (!t || t === originalTitle) {
      cancelRename();
      return;
    }
    patchChat.mutate(
      { params: { path: { id } }, body: { title: t } },
      { onSettled: () => cancelRename() },
    );
  }

  function onRenameKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    id: string,
    originalTitle: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id, originalTitle);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  }

  function confirmDeleteChatRow(id: string) {
    closeSidebarMenu();
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    deleteChat.mutate({ params: { path: { id } } });
  }

  function toggleStarChat(id: string, next: boolean) {
    patchChat.mutate({ params: { path: { id } }, body: { starred: next } });
  }

  useEffect(() => {
    if (!renamingChatId) return;
    const raf = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [renamingChatId]);

  useEffect(() => {
    if (sidebarMenu == null) return;
    function onKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") closeSidebarMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarMenu, closeSidebarMenu]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick() {
      setUserMenuOpen(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [userMenuOpen]);

  async function send() {
    if (isStreaming) return;
    const textPart = draft.trim();
    if (!textPart && pendingAttachments.length === 0) return;

    let activeChatId = chatId ?? null;
    if (!activeChatId) {
      try {
        const row = await createChat.mutateAsync({});
        activeChatId = row.id;
        void navigate({ to: "/", search: { chat: row.id, newChat: false } });
      } catch {
        setStreamError("Could not start chat");
        return;
      }
    } else if (!canEditChat) {
      return;
    }

    let content: string;
    try {
      content = await buildOutgoingContent(textPart, pendingAttachments);
    } catch (e) {
      setAttachmentHint(
        e instanceof Error ? e.message : "Could not read attachments.",
      );
      return;
    }

    setStreamError(null);
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      shouldStickToBottomRef.current =
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <=
        STICKY_SCROLL_THRESHOLD_PX;
    }
    resetStreamingBuffer();
    setStreamStatus("Thinking...");
    setOptimisticUserMessage({
      chatId: activeChatId,
      content,
      messageCountBeforeSend: messages.length,
    });
    setIsStreaming(true);

    function clearComposer() {
      setDraft("");
      setAttachmentHint(null);
      setPendingAttachments((prev) => {
        for (const p of prev) {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        }
        return [];
      });
    }

    try {
      const streamHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = await getToken();
      if (token) streamHeaders.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${env.VITE_SERVER_URL}/chats/${activeChatId}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: streamHeaders,
          body: JSON.stringify({ content }),
        },
      );

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) detail = j.message;
        } catch {
          /* ignore */
        }
        setStreamError(detail || "Request failed");
        setOptimisticUserMessage(null);
        void refetchMessages();
        void refetchChats();
        return;
      }

      clearComposer();
      let shouldRefreshAfterStream = false;

      const reader = res.body?.getReader();
      if (!reader) {
        setStreamError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: ChatStreamEvent;
          try {
            ev = JSON.parse(line) as ChatStreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "user") {
            void refetchMessages();
            void refetchChats();
          } else if (ev.type === "status") {
            setStreamStatus(ev.text);
          } else if (ev.type === "map") {
            setStreamingCmuMaps(ev.cmuMaps);
          } else if (ev.type === "delta") {
            setStreamStatus(null);
            enqueueStreamingText(ev.text);
          } else if (ev.type === "done") {
            shouldRefreshAfterStream = true;
          } else if (ev.type === "error") {
            setStreamError(ev.message);
            void refetchMessages();
          }
        }
      }
      await waitForStreamingFlush();
      if (shouldRefreshAfterStream) {
        await refetchMessages();
        await refetchChats();
        setIsStreaming(false);
        resetStreamingBuffer();
      }
    } catch {
      setStreamError("Network error");
      void refetchMessages();
    } finally {
      setIsStreaming(false);
      resetStreamingBuffer();
    }
  }

  const sidebarMenuChat =
    sidebarMenu != null
      ? chats.find((x) => x.id === sidebarMenu.chatId)
      : undefined;

  return (
    <div className="relative flex h-dvh min-h-[480px] bg-white text-neutral-900">
      <ChatSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        setSearchQ={setSearchQ}
        searchInputRef={searchInputRef}
        onNewChat={() =>
          void navigate({ to: "/", search: { chat: undefined, newChat: true } })
        }
        chatId={chatId}
        starred={starredChats}
        unstarred={unstarredChats}
        toggleStarChat={toggleStarChat}
        renamingChatId={renamingChatId}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        renameInputRef={renameInputRef}
        commitRename={commitRename}
        onRenameKeyDown={onRenameKeyDown}
        setSidebarMenu={setSidebarMenu}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        user={user}
        displayName={displayName}
        signOut={() => void signOut()}
        setActiveModal={setActiveModal}
        selectChat={selectChat}
        beginRename={beginRename}
      />

      <SidebarContextMenu
        sidebarMenu={sidebarMenu}
        sidebarMenuChat={sidebarMenuChat}
        closeSidebarMenu={closeSidebarMenu}
        beginRename={beginRename}
        toggleStarChat={toggleStarChat}
        onDelete={confirmDeleteChatRow}
        deleteIsPending={deleteChat.isPending}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {searchMode ? (
          <SearchPanel
            searchQ={searchQ}
            setSearchQ={setSearchQ}
            searchInputRef={searchInputRef}
            chats={searchChats}
            chatsLoading={searchChatsLoading}
            onSelectSearchResult={(id) => {
              selectChat(id);
              setSearchMode(false);
              setSearchQ("");
            }}
            onNewChat={() => {
              setSearchMode(false);
              setSearchQ("");
              void navigate({
                to: "/",
                search: { chat: undefined, newChat: true },
              });
            }}
          />
        ) : (
          <>
            <ChatHeader
              sidebarOpen={sidebarOpen}
              showMakePrivate={showMakePrivate}
              makeChatPrivate={makeChatPrivate}
              patchChatIsPending={patchChat.isPending}
              shareChat={shareChat}
              chatId={chatId}
              effectiveChatDetailExists={Boolean(effectiveChatDetail)}
              shareFeedback={shareFeedback}
              currentChat={currentChat}
              toggleStarChat={toggleStarChat}
              isNewChatIntent={Boolean(isNewChatIntent)}
              currentChatTitle={currentChat?.title}
            />
            <div className="mx-6 mt-2 border-b border-fg-disabled-brandneutral" />

            <ChatMessages
              scrollContainerRef={scrollContainerRef}
              bottomRef={bottomRef}
              shouldStickToBottomRef={shouldStickToBottomRef}
              shouldShowConversation={shouldShowConversation}
              showMessagesLoading={showMessagesLoading}
              messages={messages}
              chatsLoading={chatsLoading}
              chatId={chatId}
              isNewChatIntent={isNewChatIntent}
              shouldShowOptimisticUserMessage={shouldShowOptimisticUserMessage}
              optimisticUserMessage={optimisticUserMessage}
              isStreaming={isStreaming}
              streamingText={streamingText}
              streamStatus={streamStatus}
              activeCmuMaps={activeCmuMaps}
              draftComposerRef={draftComposerRef}
              draft={draft}
              setDraft={setDraft}
              setAttachmentHint={setAttachmentHint}
              canEditChat={canEditChat}
              onSend={send}
              createChatIsPending={createChat.isPending}
              pendingAttachments={pendingAttachments}
            />

            <ChatComposer
              draftComposerRef={draftComposerRef}
              fileInputRef={fileInputRef}
              draft={draft}
              setDraft={setDraft}
              isStreaming={isStreaming}
              chatId={chatId}
              canEditChat={canEditChat}
              createChatIsPending={createChat.isPending}
              onSend={send}
              pendingAttachments={pendingAttachments}
              attachmentHint={attachmentHint}
              setAttachmentHint={setAttachmentHint}
              onAttachmentFilesSelected={onAttachmentFilesSelected}
              removePendingAttachment={removePendingAttachment}
              streamError={streamError}
              shouldShowConversation={shouldShowConversation}
              chatsLoading={chatsLoading}
              isNewChatIntent={isNewChatIntent}
            />

            <ChatModal
              activeModal={activeModal}
              onClose={() => setActiveModal(null)}
              mapsIsDisabled={mapsIsDisabled}
              setMapsIsDisabled={setMapsIsDisabled}
              eatsIsDisabled={eatsIsDisabled}
              setEatsIsDisabled={setEatsIsDisabled}
              coursesIsDisabled={coursesIsDisabled}
              setCoursesIsDisabled={setCoursesIsDisabled}
              lang={lang}
              setLang={setLang}
              langOpen={langOpen}
              setLangOpen={setLangOpen}
            />
          </>
        )}
      </main>
    </div>
  );
}
