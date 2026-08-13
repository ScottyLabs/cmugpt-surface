import { BookOpen } from "lucide-react";
import { useState } from "react";
import { CmuMapsIcon } from "@/components/icons/CmuMapsIcon.tsx";
import { CHAT_TOOLS, type ChatToolOption } from "../tools.ts";
import type { ChatShellController } from "../useChatShell.ts";

/** Per-tool artwork. Dimmed and desaturated while the tool is switched off. */
function ToolIcon({ id, enabled }: { id: string; enabled: boolean }) {
  const tint = enabled ? "opacity-100" : "opacity-40 grayscale";
  if (id === "maps") {
    return <CmuMapsIcon className={`shrink-0 w-auto ${tint}`} />;
  }
  if (id === "courses") {
    return (
      <img
        src="/cmucoursesicon.png"
        alt=""
        className={`h-4.25 w-4.5 shrink-0 rounded-sm object-contain ${tint}`}
      />
    );
  }
  if (id === "eats") {
    return (
      <img
        src="/cmueatsicon.png"
        alt=""
        className={`h-5.25 w-5.25 shrink-0 object-contain ${tint}`}
      />
    );
  }
  if (id === "guide") {
    return <BookOpen aria-hidden className={`h-4 w-4 shrink-0 ${tint}`} />;
  }
  // A tool added to CHAT_TOOLS without artwork here renders label-only rather
  // than borrowing another tool's icon.
  return null;
}

/** Trailing On/Off badge, so the state is readable without relying on colour.
 *  Fixed width: "On" and "Off" occupy the same space, so toggling never
 *  resizes the button. */
function ToolStateBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`ml-0.5 w-7 rounded-full py-px text-center text-[0.625rem] font-semibold uppercase tracking-wide ${
        enabled
          ? "bg-brand-secondary-enabled text-fg-neutral-primary"
          : "bg-white text-fg-neutral-tertiary"
      }`}
    >
      {enabled ? "On" : "Off"}
    </span>
  );
}

/** A tool switch. Raised and full colour means the agent may call it; flat and
 *  greyed means it is withheld for the turn. Both states keep the exact same
 *  footprint: only colours change on toggle, never the layout. */
function ToolToggleButton({
  tool,
  enabled,
  onToggle,
}: {
  tool: ChatToolOption;
  enabled: boolean;
  onToggle: () => void;
}) {
  // After a click the pointer is still parked on the button, so the browser
  // keeps matching :hover and the freshly toggled state looks highlighted.
  // Disarm hover styling on click and re-arm it once the pointer leaves, so
  // the plain new state shows immediately and hover only returns on the next
  // approach.
  const [hoverArmed, setHoverArmed] = useState(true);
  return (
    <button
      type="button"
      onClick={() => {
        setHoverArmed(false);
        onToggle();
      }}
      onMouseLeave={() => {
        setHoverArmed(true);
      }}
      aria-pressed={enabled}
      title={
        enabled
          ? `${tool.label} is on. Click to stop the assistant using it`
          : `${tool.label} is off. Click to let the assistant use it again`
      }
      className={`flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-neutral-tertiary ${
        enabled
          ? "border-stroke-neutral-1 bg-white text-fg-neutral-primary shadow-[0_1px_3px_0_rgba(158,177,194,0.5)]"
          : "border-transparent bg-neutral-secondary-enabled text-fg-disabled-neutral"
      } ${
        hoverArmed
          ? enabled
            ? "hover:border-fg-neutral-tertiary hover:bg-brand-secondary-hover"
            : "hover:bg-brandneutral-secondary-enabled hover:text-fg-neutral-secondary"
          : ""
      }`}
    >
      <ToolIcon id={tool.id} enabled={enabled} />
      {tool.label}
      <ToolStateBadge enabled={enabled} />
    </button>
  );
}

function ToolToggles({ c }: { c: ChatShellController }) {
  const { tools } = c;
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
      {CHAT_TOOLS.map((tool) => (
        <ToolToggleButton
          key={tool.id}
          tool={tool}
          enabled={tools.isEnabled(tool.id)}
          onToggle={() => {
            tools.toggle(tool.id);
          }}
        />
      ))}
    </div>
  );
}

export function SettingsPanel({ c }: { c: ChatShellController }) {
  return (
    <div className="flex flex-col gap-6 px-2 pt-2">
      <div className="flex flex-col gap-4 pl-4">
        <div className="flex flex-col gap-1">
          <p className="text-left text-sm font-medium text-black">Tools</p>
          <p className="text-left text-xs font-normal text-fg-neutral-secondary">
            Click a tool to switch it off. While it is off, CMUGPT cannot use it to answer you.
          </p>
        </div>
        <ToolToggles c={c} />
      </div>
    </div>
  );
}
