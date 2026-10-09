import net from "node:net";
import { err, ok, type Result } from "@/core/result";
import type { PrintError, PrintTransport } from "./transport";

export function createTcpTransport(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): PrintTransport {
  const timeoutMs = options.timeoutMs ?? 3000;
  return {
    send(bytes: Uint8Array): Promise<Result<void, PrintError>> {
      return new Promise((resolve) => {
        const socket = net.createConnection({ host: options.host, port: options.port });
        let settled = false;
        let connected = false;
        const finish = (result: Result<void, PrintError>) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(timeoutMs);
        socket.once("timeout", () => finish(err({ kind: "timeout" })));
        socket.once("error", (error: Error) =>
          finish(connected ? err({ kind: "io", message: error.message }) : err({ kind: "connection", message: error.message })),
        );
        socket.once("connect", () => {
          connected = true;
          // Resolver al terminar de enviar (no esperar el FIN del peer): si la
          // impresora deja la conexión abierta, esperar "close" daría timeout
          // espurio -> reintento -> ticket duplicado.
          socket.end(Buffer.from(bytes), () => finish(ok(undefined)));
        });
      });
    },
  };
}
