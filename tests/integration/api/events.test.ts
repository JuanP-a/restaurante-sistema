import { describe, expect, test } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/events/route";
import { emitEvent } from "@/infra/events/event-bus";

function makeReq(): NextRequest {
  return new Request("http://localhost/api/events") as unknown as NextRequest;
}

async function readChunks(
  stream: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 1000,
): Promise<string[]> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  const chunks: string[] = [];
  const start = Date.now();
  while (chunks.length < count) {
    if (Date.now() - start > timeoutMs) break;
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(dec.decode(value));
  }
  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  return chunks;
}

describe("GET /api/events (SSE)", () => {
  test("responde con content-type text/event-stream y cache-control no-cache", async () => {
    const res = await GET(makeReq());
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  test("primer chunk es un evento 'hello'", async () => {
    const res = await GET(makeReq());
    const chunks = await readChunks(res.body as ReadableStream<Uint8Array>, 1);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toMatch(/^event: hello\ndata: \{"ts":\d+\}\n\n$/);
  });

  test("emite order_created como SSE cuando se publica en el bus", async () => {
    const res = await GET(makeReq());
    emitEvent("order_created", { sequentialNumber: 99 });
    const chunks = await readChunks(res.body as ReadableStream<Uint8Array>, 2);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toMatch(/^event: hello/);
    expect(chunks[1]).toMatch(
      /^event: order_created\ndata: \{"sequentialNumber":99\}\n\n$/,
    );
  });
});
