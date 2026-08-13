import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";

type Model = {
  id: string;
  label: string;
};

export function useCloseOnOutsideOrEscape(
  open: boolean,
  setOpen: (open: boolean) => void,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    function onDocumentMouseDown(e: MouseEvent) {
      if (wrapperRef.current === null) {
        return;
      }
      if (e.target instanceof Node && wrapperRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, wrapperRef]);
}

function ModelSelectorTrigger({
  open,
  setOpen,
  currentLabel,
}: {
  open: boolean;
  setOpen: (updater: (o: boolean) => boolean) => void;
  currentLabel: string;
}) {
  // Compact by default: show only the first word of the model name (e.g.
  // "GPT-5.4"). The full names are visible once the dropdown expands.
  const shortLabel = currentLabel.split(" ")[0];
  return (
    <button
      type="button"
      onClick={() => {
        setOpen((o) => !o);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-neutral-700 text-sm font-medium transition-colors hover:bg-neutral-100"
      aria-haspopup="listbox"
      aria-expanded={open}
      title="Change the LLM used for new messages"
    >
      <span className="max-w-[9rem] truncate">{shortLabel}</span>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
        aria-hidden
      />
    </button>
  );
}

function ModelOption({
  model,
  selected,
  onSelect,
}: {
  model: Model;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(model.id);
        }}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 ${
          selected ? "bg-neutral-100" : ""
        }`}
      >
        <span
          className={`flex-1 truncate font-medium ${
            selected ? "text-red-800" : "text-neutral-900"
          }`}
        >
          {model.label}
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 text-red-800" aria-hidden />}
      </button>
    </li>
  );
}

/** Compact "currently using model X" dropdown for the chat input bar. */
/** Model list plus the user's current pick, with a setter that persists it. */
function useModelPreference() {
  const { data: modelsData } = $api.useQuery("get", "/me/models");
  const { data: prefs, refetch: refetchPrefs } = $api.useQuery(
    "get",
    "/me/preferences",
  );
  const updatePreferences = $api.useMutation("patch", "/me/preferences", {
    onSuccess: () => {
      void refetchPrefs();
    },
  });
  const models = modelsData?.models ?? [];
  const currentId = prefs?.preferredModel;
  const currentLabel = models.find((m) => m.id === currentId)?.label ??
    "Loading...";
  function persistModel(id: string) {
    if (id === currentId) {
      return;
    }
    updatePreferences.mutate({ body: { preferredModel: id } });
  }
  return { models, currentId, currentLabel, persistModel };
}

export function ModelSelector() {
  const { models, currentId, currentLabel, persistModel } =
    useModelPreference();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useCloseOnOutsideOrEscape(open, setOpen, wrapperRef);

  function selectModel(id: string) {
    setOpen(false);
    persistModel(id);
  }

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <ModelSelectorTrigger
        open={open}
        setOpen={setOpen}
        currentLabel={currentLabel}
      />
      {open && models.length > 0 && (
        <ul className="absolute bottom-full right-0 z-20 mb-2 max-h-80 w-56 origin-bottom-right overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg transition duration-150 ease-out starting:scale-95 starting:opacity-0">
          {models.map((m) => (
            <ModelOption
              key={m.id}
              model={m}
              selected={m.id === currentId}
              onSelect={selectModel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
