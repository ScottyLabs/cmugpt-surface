import { MemoryManager } from "./MemoryManager.tsx";
import { useChatShell } from "./chat/useChatShell.ts";
import { ChatHeaderBar } from "./chat/views/ChatHeaderBar.tsx";
import { ChatSidebar } from "./chat/views/ChatSidebar.tsx";
import { ComposerFooter } from "./chat/views/ComposerFooter.tsx";
import { ConversationView } from "./chat/views/ConversationView.tsx";
import { SearchPanel } from "./chat/views/SearchPanel.tsx";
import { SettingsAboutModal } from "./chat/views/SettingsAboutModal.tsx";
import { SidebarContextMenu } from "./chat/views/SidebarContextMenu.tsx";

export function ChatShell() {
  const c = useChatShell();
  return (
    <div className="relative flex h-dvh min-h-[480px] overflow-hidden bg-white text-neutral-900">
      {c.isMobile && c.sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => {
            c.setSidebarOpen(false);
          }}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <ChatSidebar c={c} />
      <SidebarContextMenu c={c} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {c.search.searchMode ? (
          <SearchPanel c={c} />
        ) : (
          <>
            <ChatHeaderBar c={c} />
            <ConversationView c={c} />
            <ComposerFooter c={c} />
          </>
        )}
        <SettingsAboutModal c={c} />
      </main>
      <MemoryManager
        open={c.memory.managerOpen}
        onClose={c.memory.closeManager}
        returnFocusRef={c.memory.userMenuTriggerRef}
      />
    </div>
  );
}
