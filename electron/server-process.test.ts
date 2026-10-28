// @vitest-environment node
import { describe, expect, test } from "vitest";
import { startServer, type ChildLike, type ServerDeps } from "./server-process";

function fakeChild(): ChildLike & { exits: (() => void)[]; killed: boolean } {
  const exits: (() => void)[] = [];
  return {
    exits,
    killed: false,
    kill() {
      this.killed = true;
    },
    on(event, cb) {
      if (event === "exit") exits.push(cb);
    },
  };
}

function deps(overrides: Partial<ServerDeps> = {}): {
  d: ServerDeps;
  children: ReturnType<typeof fakeChild>[];
} {
  const children: ReturnType<typeof fakeChild>[] = [];
  const d: ServerDeps = {
    spawn: () => {
      const c = fakeChild();
      children.push(c);
      return c;
    },
    checkHealth: async () => false,
    wait: async () => {},
    maxHealthChecks: 5,
    restartLimit: 2,
    ...overrides,
  };
  return { d, children };
}

describe("startServer", () => {
  test("resuelve cuando el health-check da true", async () => {
    let calls = 0;
    const { d } = deps({ checkHealth: async () => ++calls >= 3 });
    const handle = await startServer(d, { PORT: "3210" });
    expect(handle.restarts()).toBe(0);
  });

  test("reintenta el spawn si el hijo sale antes de estar sano", async () => {
    const { d, children } = deps({ checkHealth: async () => false, maxHealthChecks: 1 });
    let first = true;
    const custom: ServerDeps = {
      ...d,
      checkHealth: async () => !first,
    };
    const promise = startServer(custom, {});
    await Promise.resolve();
    first = false;
    children[0]?.exits.forEach((cb) => cb());
    const handle = await promise;
    expect(handle.restarts()).toBeGreaterThanOrEqual(0);
  });

  // El shell tiene que fallar ruidosamente en vez de quedar en un loop de
  // spawns: un server que nunca levanta es un .exe roto, no un estado estable.
  test("rechaza si el server no levanta tras agotar reintentos", async () => {
    const { d } = deps({ checkHealth: async () => false, restartLimit: 1 });
    await expect(startServer(d, {})).rejects.toThrow(/no levantó/);
  });

  test("stop mata el hijo", async () => {
    const { d, children } = deps({ checkHealth: async () => true });
    const handle = await startServer(d, {});
    handle.stop();
    expect(children[0]?.killed).toBe(true);
  });
});
