/**
 * Batches streaming text into animation-frame flushes so React state updates
 * stay coalesced during a fast SSE stream. Mirrors the original ref-based
 * buffer that lived inside `ChatShell`.
 */
export class StreamBuffer {
  #buffer = "";
  #frame: number | null = null;
  #resolvers: Array<() => void> = [];
  readonly #appendText: (chunk: string) => void;

  constructor(appendText: (chunk: string) => void) {
    this.#appendText = appendText;
  }

  #resolveWaiters() {
    const pending = this.#resolvers;
    this.#resolvers = [];
    for (const resolve of pending) {
      resolve();
    }
  }

  #flush = () => {
    this.#frame = null;
    const next = this.#buffer;
    this.#buffer = "";
    if (next !== "") {
      this.#appendText(next);
    }
    this.#resolveWaiters();
  };

  #cancelFrame() {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }

  enqueue(text: string) {
    if (text === "") {
      return;
    }
    this.#buffer += text;
    this.#frame ??= requestAnimationFrame(this.#flush);
  }

  waitForFlush(): Promise<void> {
    if (this.#buffer === "" && this.#frame === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#resolvers.push(resolve);
    });
  }

  reset() {
    this.#buffer = "";
    this.#cancelFrame();
    this.#resolveWaiters();
  }

  dispose() {
    this.#cancelFrame();
    this.#resolveWaiters();
  }
}
