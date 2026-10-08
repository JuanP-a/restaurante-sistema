import type { Result } from "@/core/result";

export type PrintError =
  | { kind: "not_configured" }
  | { kind: "timeout" }
  | { kind: "connection"; message: string }
  | { kind: "io"; message: string };

export type PrintTransport = {
  send(bytes: Uint8Array): Promise<Result<void, PrintError>>;
};
