import { useCallback, useMemo, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";

function searchQueryInit(searchQ: string) {
  const q = searchQ.trim();
  return q === "" ? undefined : ({ params: { query: { q } } } as const);
}

export function useChatSearch() {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchChatsQueryInit = useMemo(() => searchQueryInit(searchQ), [
    searchQ,
  ]);

  const { data: searchChats = [], isLoading: searchChatsLoading } = $api
    .useQuery(
      "get",
      "/chats",
      searchChatsQueryInit,
      { enabled: Boolean(searchQ.trim()) },
    );

  const openSearch = useCallback(() => {
    setSearchMode(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const closeSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQ("");
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchMode((open) => {
      if (open) {
        setSearchQ("");
        return false;
      }
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return true;
    });
  }, []);

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
