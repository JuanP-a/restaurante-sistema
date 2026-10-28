export type ChildLike = {
  kill: () => void;
  on: (event: "exit", cb: () => void) => void;
};

export type ServerDeps = {
  spawn: (env: Record<string, string>) => ChildLike;
  checkHealth: () => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
  maxHealthChecks?: number;
  restartLimit?: number;
  onLog?: (line: string) => void;
};

export type ServerHandle = { stop: () => void; restarts: () => number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function stopServer(child: ChildLike): void {
  child.kill();
}

async function waitHealthy(deps: ServerDeps): Promise<boolean> {
  const wait = deps.wait ?? sleep;
  const max = deps.maxHealthChecks ?? 60;
  for (let i = 0; i < max; i += 1) {
    if (await deps.checkHealth()) return true;
    await wait(500);
  }
  return false;
}

export async function startServer(
  deps: ServerDeps,
  env: Record<string, string>,
): Promise<ServerHandle> {
  const restartLimit = deps.restartLimit ?? 3;
  let restarts = 0;
  let child = deps.spawn(env);
  let stopped = false;

  child.on("exit", () => {
    if (stopped) return;
    deps.onLog?.("server hijo terminó inesperadamente");
  });

  while (!(await waitHealthy(deps))) {
    if (stopped || restarts >= restartLimit) {
      throw new Error(`el server no levantó tras ${restarts} reinicios`);
    }
    restarts += 1;
    deps.onLog?.(`reintento de arranque ${restarts}/${restartLimit}`);
    stopServer(child);
    child = deps.spawn(env);
  }

  return {
    stop() {
      stopped = true;
      stopServer(child);
    },
    restarts: () => restarts,
  };
}
