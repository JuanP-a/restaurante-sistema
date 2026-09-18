import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitEvent(kind: string, data: unknown): void {
  emitter.emit(kind, data);
}

export function subscribe(
  kind: string,
  listener: (data: unknown) => void,
): () => void {
  emitter.on(kind, listener);
  return () => {
    emitter.off(kind, listener);
  };
}
