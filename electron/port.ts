import net from "node:net";

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function pickPort(
  start: number,
  isFree: (port: number) => Promise<boolean> = isPortFree,
  maxTries = 20,
): Promise<number> {
  for (let port = start; port < start + maxTries; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error(`no hay puerto libre desde ${start} (probé ${maxTries})`);
}
