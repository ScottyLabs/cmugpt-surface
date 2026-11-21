import { useEffect, useRef, useState } from "react";
import { StreamBuffer } from "./StreamBuffer.ts";
import type { CmuMapsPayload } from "./types.ts";

/** One AbortController per send, so Stop can cancel the request in flight. */
function useStreamRequest() {
  const requestRef = useRef<AbortController | null>(null);
  return {
    beginRequest: () => {
      const controller = new AbortController();
      requestRef.current = controller;
      return controller.signal;
    },
    stopStream: () => {
      requestRef.current?.abort();
    },
  };
}

export function useStreamController() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingCmuMaps, setStreamingCmuMaps] = useState<CmuMapsPayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const request = useStreamRequest();
  const [buffer] = useState(
    () =>
      new StreamBuffer((chunk) => {
        setStreamingText((current) => current + chunk);
      }),
  );

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
    streamError,
    setStreamError,
    enqueueStreamingText: (text: string) => {
      buffer.enqueue(text);
    },
    waitForStreamingFlush: () => buffer.waitForFlush(),
    resetStreamingBuffer,
    ...request,
  };
}

export type StreamController = ReturnType<typeof useStreamController>;
