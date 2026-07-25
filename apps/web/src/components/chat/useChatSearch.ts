import { useMemo, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";

export function useChatSearch() {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchChatsQueryInit = useMemo(() => {
    const q = searchQ.trim();
    return q === "" ? undefined : ({ params: { query: { q } } } as const);
  }, [searchQ]);

  const { data: searchChats = [], isLoading: searchChatsLoading } = $api.useQuery(
    "get",
    "/chats",
    searchChatsQueryInit,
    { enabled: Boolean(searchQ.trim()) },
  );

  function openSearch() {
    setSearchMode(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function closeSearch() {
    setSearchMode(false);
    setSearchQ("");
  }

  function toggleSearch() {
    if (searchMode) {
      closeSearch();
    } else {
      openSearch();
    }
  }

  return {
    searchMode,
    searchQ,
    setSearchQ,
    searchInputRef,
    searchChats,
    searchChatsLoading,
    openSearch,
    closeSearch,
    toggleSearch,
  };
}

export type ChatSearch = ReturnType<typeof useChatSearch>;
