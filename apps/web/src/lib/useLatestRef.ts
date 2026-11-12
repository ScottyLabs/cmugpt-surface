import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/** A ref holding the latest committed value, for handlers and effects that outlive the render that created them. Updated in a layout effect, so it is current before any passive effect or event handler reads it. */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
