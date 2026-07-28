import { useState } from "react";

export function useModalState() {
  const [activeModal, setActiveModal] = useState<"settings" | "about" | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("Auto-detect");

  return {
    activeModal,
    setActiveModal,
    langOpen,
    setLangOpen,
    lang,
    setLang,
  };
}

export type ModalState = ReturnType<typeof useModalState>;
