import { useState } from "react";

export function useModalState() {
  const [activeModal, setActiveModal] = useState<"settings" | "about" | null>(null);
  const [mapsIsDisabled, setMapsIsDisabled] = useState(false);
  const [eatsIsDisabled, setEatsIsDisabled] = useState(false);
  const [coursesIsDisabled, setCoursesIsDisabled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("Auto-detect");

  return {
    activeModal,
    setActiveModal,
    mapsIsDisabled,
    setMapsIsDisabled,
    eatsIsDisabled,
    setEatsIsDisabled,
    coursesIsDisabled,
    setCoursesIsDisabled,
    langOpen,
    setLangOpen,
    lang,
    setLang,
  };
}

export type ModalState = ReturnType<typeof useModalState>;
