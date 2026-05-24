import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";

/** Compact "currently using model X" dropdown for the chat input bar. */
export function ModelSelector() {
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

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocumentMouseDown(e: MouseEvent) {
      if (!wrapperRef.current) {
        return;
      }
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
  }, [open]);

  const models = modelsData?.models ?? [];
  const currentId = prefs?.preferredModel;
  const currentLabel =
    models.find((m) => m.id === currentId)?.label ?? "Loading…";

  function selectModel(id: string) {
    setOpen(false);
    if (id === currentId) {
      return;
    }
    updatePreferences.mutate({ body: { preferredModel: id } });
  }

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 text-xs font-medium hover:border-neutral-300 hover:bg-neutral-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change the LLM used for new messages"
      >
        <span className="text-neutral-500">Model:</span>
        <span>{currentLabel}</span>
        <ChevronDown className="h-3 w-3 text-neutral-400" aria-hidden={true} />
      </button>
      {open && models.length > 0 && (
        <ul className="absolute top-full left-0 z-20 mt-1 w-72 max-h-80 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
          {models.map((m) => {
            const selected = m.id === currentId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => selectModel(m.id)}
                  aria-pressed={selected}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                    selected ? "bg-neutral-50" : ""
                  }`}
                >
                  <span
                    className={`font-medium ${
                      selected ? "text-red-800" : "text-neutral-900"
                    }`}
                  >
                    {m.label}
                  </span>
                  <span className="text-neutral-500 text-xs">
                    {m.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
