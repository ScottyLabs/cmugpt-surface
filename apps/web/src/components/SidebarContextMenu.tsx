interface SidebarMenuChat {
  id: string;
  title: string;
  isPublic: boolean;
}

interface SidebarContextMenuProps {
  sidebarMenu: { x: number; y: number; chatId: string } | null;
  sidebarMenuChat: SidebarMenuChat | undefined;
  closeSidebarMenu: () => void;
  beginRename: (c: { id: string; title: string }) => void;
  onShare: (id: string, isPublic: boolean) => void;
  onDelete: (id: string) => void;
  deleteIsPending: boolean;
}

export function SidebarContextMenu({
  sidebarMenu,
  sidebarMenuChat,
  closeSidebarMenu,
  beginRename,
  onShare,
  onDelete,
  deleteIsPending,
}: SidebarContextMenuProps) {
  if (sidebarMenu == null || sidebarMenuChat == null) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        aria-hidden={true}
        onClick={() => closeSidebarMenu()}
        onContextMenu={(e) => {
          e.preventDefault();
          closeSidebarMenu();
        }}
      />
      <div
        className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg"
        style={{ left: sidebarMenu.x, top: sidebarMenu.y }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
          onClick={() => beginRename(sidebarMenuChat)}
        >
          Rename
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
          onClick={() => {
            closeSidebarMenu();
            onShare(sidebarMenuChat.id, sidebarMenuChat.isPublic);
          }}
        >
          Share
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={deleteIsPending}
          className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-50"
          onClick={() => onDelete(sidebarMenuChat.id)}
        >
          Delete
        </button>
      </div>
    </>
  );
}
