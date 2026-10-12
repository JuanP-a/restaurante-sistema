// @vitest-environment node
import { describe, expect, test } from "vitest";
import { startServer, type ChildLike, type ServerDeps } from "./server-process";

type FakeChild = ChildLike & { readonly killed: boolean };

function fakeChild(): FakeChild {
  const exits: (() => void)[] = [];
  let killed = false;
  return {
    get killed() {
      return killed;
    },
    kill() {
      killed = true;
    },
    on(event: "exit", cb: () => void) {
      if (event === "exit") exits.push(cb);
    },
  };
}

function deps(overrides: Partial<ServerDeps> = {}): { d: ServerDeps; children: FakeChild[] } {
  const children: FakeChild[] = [];
  const d: ServerDeps = {
    spawn: () => {
      const c = fakeChild();
      children.push(c);
      return c;
    },
    checkHealth: async () => true,
    wait: async () => {},
    maxHealthChecks: 3,
    restartLimit: 1,
    ...overrides,
  };
  return { d, children };
}

describe("startServer", () => {
  test("resuelve cuando el health-check da true", async () => {
    const { d } = deps();
    const handle = await startServer(d, { PORT: "3210" });
    expect(handle.restarts()).toBe(0);
  });

  test("stop mata el hijo", async () => {
    const { d, children } = deps();
    const handle = await startServer(d, {});
    handle.stop();
    expect(children[0]?.killed).toBe(true);
  });

  test("rechaza si nunca levanta (agota reintentos)", async () => {
    const { d } = deps({ checkHealth: async () => false, restartLimit: 1 });
    await expect(startServer(d, {})).rejects.toThrow(/no levantó/);
  });
});
