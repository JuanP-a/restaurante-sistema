import { err, ok, type Result } from "@/core/result";
import type { PrintError, PrintTransport } from "./transport";

export type FakeTransport = PrintTransport & { sent: Uint8Array[] };

export function createFakeTransport(options?: { failTimes?: number }): FakeTransport {
  let remainingFailures = options?.failTimes ?? 0;
  const sent: Uint8Array[] = [];
  return {
    sent,
    async send(bytes: Uint8Array): Promise<Result<void, PrintError>> {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        return err({ kind: "connection", message: "fallo simulado" });
      }
      sent.push(bytes);
      return ok(undefined);
    },
  };
}
