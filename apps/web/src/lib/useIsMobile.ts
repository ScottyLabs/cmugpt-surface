import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

function getIsMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** True below Tailwind's `md` breakpoint. Used to switch the sidebar between
 *  an always-visible rail (desktop) and an off-canvas drawer (mobile). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
