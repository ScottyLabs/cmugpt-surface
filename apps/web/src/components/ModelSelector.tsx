import { ChevronDown } from "lucide-react";
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
  return (
    <button
      type="button"
      onClick={() => {
        setOpen((o) => !o);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 text-xs font-medium hover:border-neutral-300 hover:bg-neutral-50"
      aria-haspopup="listbox"
      aria-expanded={open}
      title="Change the LLM used for new messages"
    >
      <span className="text-neutral-500">Model:</span>
      <span>{currentLabel}</span>
      <ChevronDown className="h-3 w-3 text-neutral-400" aria-hidden />
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
        className={`flex w-full items-start px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
          selected ? "bg-neutral-50" : ""
        }`}
      >
        <span className={`font-medium ${selected ? "text-red-800" : "text-neutral-900"}`}>
          {model.label}
        </span>
      </button>
    </li>
  );
}

/** Compact "currently using model X" dropdown for the chat input bar. */
export function ModelSelector() {
  const { data: modelsData } = $api.useQuery("get", "/me/models");
  const { data: prefs, refetch: refetchPrefs } = $api.useQuery("get", "/me/preferences");
  const updatePreferences = $api.useMutation("patch", "/me/preferences", {
    onSuccess: () => {
      void refetchPrefs();
    },
  });

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useCloseOnOutsideOrEscape(open, setOpen, wrapperRef);

  const models = modelsData?.models ?? [];
  const currentId = prefs?.preferredModel;
  const currentLabel = models.find((m) => m.id === currentId)?.label ?? "Loading...";

  function selectModel(id: string) {
    setOpen(false);
    if (id === currentId) {
      return;
    }
    updatePreferences.mutate({ body: { preferredModel: id } });
  }

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <ModelSelectorTrigger open={open} setOpen={setOpen} currentLabel={currentLabel} />
      {open && models.length > 0 && (
        <ul className="absolute top-full left-0 z-20 mt-1 w-72 max-h-80 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
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
