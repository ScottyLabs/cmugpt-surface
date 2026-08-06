import { useState } from "react";

export function useModalState() {
  const [activeModal, setActiveModal] = useState<"settings" | "about" | null>(null);

  return {
    activeModal,
    setActiveModal,
  };
}

export type ModalState = ReturnType<typeof useModalState>;
