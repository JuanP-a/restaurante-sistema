import { NextRequest } from "next/server";
import { subscribe } from "@/infra/events/event-bus";

export const dynamic = "force-dynamic";

type SseController = ReadableStreamDefaultController<Uint8Array>;

export async function GET(_req: NextRequest): Promise<Response> {
  const enc = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller: SseController) {
      const send = (event: string, data: unknown): void => {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(enc.encode(chunk));
      };

      send("hello", { ts: Date.now() });

      const unsub = subscribe("order_created", (data) => {
        send("order_created", data);
      });
      pingTimer = setInterval(() => {
        controller.enqueue(enc.encode(": ping\n\n"));
      }, 15000);

      cleanup = () => {
        if (pingTimer) clearInterval(pingTimer);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
