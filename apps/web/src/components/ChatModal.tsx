import {
  CheckIcon,
  CloseIcon,
  CmuMapsIcon,
  DownArrowIcon,
} from "@/components/icons/ChatIcons.tsx";

interface ChatModalProps {
  activeModal: "settings" | "about" | null;
  onClose: () => void;
  mapsIsDisabled: boolean;
  setMapsIsDisabled: (v: boolean) => void;
  eatsIsDisabled: boolean;
  setEatsIsDisabled: (v: boolean) => void;
  coursesIsDisabled: boolean;
  setCoursesIsDisabled: (v: boolean) => void;
  lang: string;
  setLang: (l: string) => void;
  langOpen: boolean;
  setLangOpen: (o: boolean) => void;
}

export function ChatModal({
  activeModal,
  onClose,
  mapsIsDisabled,
  setMapsIsDisabled,
  eatsIsDisabled,
  setEatsIsDisabled,
  coursesIsDisabled,
  setCoursesIsDisabled,
  lang,
  setLang,
  langOpen,
  setLangOpen,
}: ChatModalProps) {
  if (!activeModal) return null;

  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 flex items-center justify-center bg-[rgba(245,245,245,0.75)] backdrop-blur-[3.55px] w-full"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        className={`relative rounded-2xl bg-white p-6 shadow-[0_2px_6px_0_rgba(0,0,0,0.20)] w-[45.5625rem] ${activeModal === "settings" ? "h-[20rem]" : "h-[30rem]"}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl pt-4 pl-4 font-medium leading-8">
            {activeModal === "settings" ? "Settings" : "About CMUGPT"}
          </h2>
          <button type="button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {activeModal === "settings" && (
          <div className="flex flex-col gap-6 px-2 pt-2">
            <div className="flex flex-col gap-4">
              <div className="pl-4 flex items-center justify-between">
                <span className="text-sm font-medium text-black">Language</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLangOpen(!langOpen);
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-black"
                  >
                    {lang}
                    <DownArrowIcon />
                  </button>

                  {Boolean(langOpen) && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-[14.5625rem] rounded-[0.75rem] bg-white shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] overflow-y-auto py-2">
                      {[
                        { id: "auto-detect", label: "Auto-detect" },
                        { id: "english-us", label: "English (US)" },
                        { id: "language-1", label: "Language" },
                        { id: "language-2", label: "Language" },
                        { id: "language-3", label: "Language" },
                        { id: "language-4", label: "Language" },
                      ].map((option, i) => (
                        <>
                          {i === 2 && (
                            <div
                              key="divider"
                              className="mx-3 my-2 border-b border-fg-disabled-brandneutral"
                            />
                          )}
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setLang(option.label);
                              setLangOpen(false);
                            }}
                            className="flex px-4 py-2 w-full items-center justify-between text-black text-xs font-medium text-left hover:bg-neutral-50"
                          >
                            {option.label}
                            {lang === option.label && <CheckIcon />}
                          </button>
                        </>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4 border-b border-fg-disabled-brandneutral" />
            </div>

            <div className="flex flex-col gap-4 pl-4">
              <p className="text-left text-sm font-medium text-black">Tools</p>
              <div className="flex gap-4 flex-wrap">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-[0.375rem] rounded-[6.25rem] px-3.5 py-1.5 text-xs font-medium bg-neutral-secondary-enabled ${mapsIsDisabled ? "text-fg-disabled-neutral" : "text-fg-neutral-primary"}`}
                  onClick={() => setMapsIsDisabled(!mapsIsDisabled)}
                >
                  <CmuMapsIcon
                    className={`shrink-0 w-auto ${mapsIsDisabled ? "opacity-55" : "opacity-100"}`}
                  />
                  CMUMaps
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-[0.375rem] rounded-[6.25rem] px-3.5 py-1.5 text-xs font-medium bg-neutral-secondary-enabled ${coursesIsDisabled ? "text-fg-disabled-neutral" : "text-fg-neutral-primary"}`}
                  onClick={() => setCoursesIsDisabled(!coursesIsDisabled)}
                >
                  <span
                    className={`w-[1.125rem] h-[1.0625rem] rounded-[0.25rem] bg-cover bg-center bg-no-repeat ${coursesIsDisabled ? "opacity-55" : "opacity-100"}`}
                    style={{
                      aspectRatio: "18/17",
                      backgroundImage: "url('../../public/cmucoursesicon.png')",
                    }}
                  />
                  CMUCourses
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-[0.375rem] rounded-[6.25rem] px-3.5 py-1.5 text-xs font-medium bg-neutral-secondary-enabled ${eatsIsDisabled ? "text-fg-disabled-neutral" : "text-fg-neutral-primary"}`}
                  onClick={() => setEatsIsDisabled(!eatsIsDisabled)}
                >
                  <span
                    className={`w-[1.3125rem] h-[1.3125rem] bg-cover bg-center bg-no-repeat ${eatsIsDisabled ? "opacity-55" : "opacity-100"}`}
                    style={{
                      backgroundImage: "url('../../public/cmueatsicon.png')",
                    }}
                  />
                  CMUEats
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === "about" && (
          <>
            <p className="text-left text-sm text-black pl-4 font-normal">
              CMUGPT is an AI tool for CMU community ..... made by
              Scottylabs...........
            </p>
            <div className="flex items-center justify-end gap-2 mt-[19rem] mr-4">
              <p className="text-base font-medium text-black">With love,</p>
              <button
                type="button"
                className="rounded-[6.25rem] px-3.5 py-1"
                style={{
                  background: "white",
                  border: "2px solid transparent",
                  backgroundImage:
                    "linear-gradient(white, white), linear-gradient(to bottom, #2B0D77, #29DAFA, #29DAFA, #FC1833)",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                }}
              >
                <span className="text-sm font-semibold text-fg-neutral-primary">
                  ScottyLabs
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </button>
  );
}
