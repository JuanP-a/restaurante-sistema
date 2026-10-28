import os from "node:os";

export type NetInterface = { address: string; family: string; internal: boolean };

export function pickLanAddress(ifaces: Record<string, NetInterface[]>): string | null {
  for (const list of Object.values(ifaces)) {
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

export function lanUrl(address: string, port: number): string {
  return `http://${address}:${port}`;
}

export function detectLanUrl(port: number): string | null {
  // Se normaliza a mano en vez de castear: os.networkInterfaces() devuelve
  // listas posiblemente indefinidas por interfaz.
  const ifaces: Record<string, NetInterface[]> = {};
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (!list) continue;
    ifaces[name] = list.map((iface) => ({
      address: iface.address,
      family: iface.family,
      internal: iface.internal,
    }));
  }
  const address = pickLanAddress(ifaces);
  return address ? lanUrl(address, port) : null;
}
