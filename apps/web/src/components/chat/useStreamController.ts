import { useEffect, useRef, useState } from "react";
import { StreamBuffer } from "./StreamBuffer.ts";
import type { CmuMapsPayload, SavedMemoryNotice } from "./types.ts";

export function useStreamController() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingCmuMaps, setStreamingCmuMaps] = useState<CmuMapsPayload | null>(null);
  const [savedMemoryNotice, setSavedMemoryNotice] = useState<SavedMemoryNotice | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const bufferRef = useRef<StreamBuffer | null>(null);
  bufferRef.current ??= new StreamBuffer((chunk) => {
    setStreamingText((current) => current + chunk);
  });
  const buffer = bufferRef.current;

  useEffect(() => {
    return () => {
      buffer.dispose();
    };
  }, [buffer]);

  function resetStreamingBuffer() {
    buffer.reset();
    setStreamingText("");
    setStreamStatus(null);
    setStreamingCmuMaps(null);
  }

  return {
    isStreaming,
    setIsStreaming,
    streamingText,
    streamStatus,
    setStreamStatus,
    streamingCmuMaps,
    setStreamingCmuMaps,
    savedMemoryNotice,
    setSavedMemoryNotice,
    streamError,
    setStreamError,
    enqueueStreamingText: (text: string) => {
      buffer.enqueue(text);
    },
    waitForStreamingFlush: () => buffer.waitForFlush(),
    resetStreamingBuffer,
  };
}

export type StreamController = ReturnType<typeof useStreamController>;
