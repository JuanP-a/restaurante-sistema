import net from "node:net";

export type CaptureServer = {
  host: string;
  port: number;
  // Resuelve cuando el cliente cierra la conexión: el cliente TCP resuelve al terminar
  // de enviar, antes de que el servidor lea, y leer antes daría un buffer vacío.
  received: () => Promise<Buffer>;
  close: () => Promise<void>;
};

// Servidor TCP real que hace de térmica: captura los bytes que le llegan.
export function startCaptureServer(): Promise<CaptureServer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let onEnd: () => void = () => {};
    const ended = new Promise<void>((done) => {
      onEnd = done;
    });
    const server = net.createServer((socket) => {
      socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      socket.on("end", onEnd);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("sin dirección");
      resolve({
        host: "127.0.0.1",
        port: address.port,
        received: async () => {
          await ended;
          return Buffer.concat(chunks);
        },
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
