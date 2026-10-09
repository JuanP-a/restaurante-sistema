// @vitest-environment node
import net from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { createTcpTransport } from "./tcp";

describe("createTcpTransport", () => {
  const servers: net.Server[] = [];
  const sockets: net.Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.destroy();
    await Promise.all(
      servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  function trackServer(server: net.Server): void {
    servers.push(server);
    server.on("connection", (socket) => sockets.push(socket));
  }

  async function startServer(onData: (chunk: Buffer) => void): Promise<number> {
    const server = net.createServer((socket) => socket.on("data", onData));
    trackServer(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("sin puerto asignado");
    return address.port;
  }

  // El transporte resuelve al terminar de enviar (no al cerrar el peer), así que
  // los bytes pueden llegar al servidor uno o dos ticks después. Esperamos la
  // recepción para que la aserción no dependa del scheduling del event loop.
  async function waitForBytes(received: Buffer[]): Promise<void> {
    const deadline = Date.now() + 1000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  test("envía los bytes a la impresora de red", async () => {
    const received: Buffer[] = [];
    const port = await startServer((chunk) => received.push(chunk));
    const transport = createTcpTransport({ host: "127.0.0.1", port });

    const result = await transport.send(Uint8Array.from([0x1b, 0x40, 0x41]));

    await waitForBytes(received);
    expect(result.ok).toBe(true);
    expect(Buffer.concat(received)).toEqual(Buffer.from([0x1b, 0x40, 0x41]));
  });

  test("devuelve error de conexión cuando nadie escucha", async () => {
    const transport = createTcpTransport({ host: "127.0.0.1", port: 1, timeoutMs: 500 });
    const result = await transport.send(Uint8Array.from([0x00]));
    expect(result.ok).toBe(false);
  });

  test("resuelve ok aunque la impresora no cierre la conexión", async () => {
    const received: Buffer[] = [];
    const server = net.createServer({ allowHalfOpen: true }, (socket) => {
      socket.on("data", (chunk: Buffer) => received.push(chunk));
    });
    trackServer(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("sin puerto asignado");
    const transport = createTcpTransport({ host: "127.0.0.1", port: address.port, timeoutMs: 500 });

    const result = await transport.send(Uint8Array.from([0x1b, 0x40]));

    await waitForBytes(received);
    expect(result.ok).toBe(true);
    expect(Buffer.concat(received)).toEqual(Buffer.from([0x1b, 0x40]));
  });
});
