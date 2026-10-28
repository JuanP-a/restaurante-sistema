import { app, BrowserWindow, dialog } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadConfig, resolveDefaultBackupDir, saveConfig } from "./config";
import { detectLanUrl } from "./lan";
import { pickPort } from "./port";
import { startServer, type ChildLike, type ServerHandle } from "./server-process";
import { createTray } from "./tray";

const START_PORT = 3210;

let window: BrowserWindow | null = null;
let server: ServerHandle | null = null;
let quitting = false;

function inheritedEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function spawnServer(env: Record<string, string>): ChildLike {
  // El standalone corre con el Node embebido de Electron (ELECTRON_RUN_AS_NODE),
  // no con utilityProcess: bajo utilityProcess PGlite (WASM) moría al arrancar
  // sin escribir nada en stdout. ELECTRON_RUN_AS_NODE es Node puro, que es el
  // entorno donde el server ya está probado.
  const entry = join(process.resourcesPath, "standalone", "server.js");
  const log = (prefix: string) => (chunk: Buffer) =>
    console.log(`[server:${prefix}]`, chunk.toString().trim());
  const child = spawn(process.execPath, [entry], {
    env: { ...inheritedEnv(), ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.on("data", log("out"));
  child.stderr?.on("data", log("err"));
  return { kill: () => child.kill(), on: (_event, cb) => child.once("exit", cb) };
}

async function boot(): Promise<void> {
  const dir = app.getPath("userData");
  const config = await loadConfig(dir);
  const port = await pickPort(config.lastPort ?? START_PORT);
  await saveConfig(dir, { ...config, lastPort: port });

  const lan = detectLanUrl(port);
  const env: Record<string, string> = {
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    NODE_ENV: "production",
    DB_DRIVER: "pglite",
    DB_PATH: join(dir, "pglite"),
    MIGRATIONS_PATH: join(process.resourcesPath, "standalone", "drizzle"),
    SESSION_SECRET: config.sessionSecret,
    // La LAN del local es HTTP: un cookie Secure no se guardaria.
    SESSION_COOKIE_SECURE: "false",
    BACKUP_DIR: resolveDefaultBackupDir(app.getPath("documents")),
    // Las deps del standalone viajan como `vendor/` (electron-builder descarta
    // cualquier node_modules en extraResources).
    NODE_PATH: join(process.resourcesPath, "standalone", "vendor"),
    ...(lan ? { DESKTOP_LAN_URL: lan } : {}),
  };

  const base = `http://127.0.0.1:${port}`;
  server = await startServer(
    {
      spawn: spawnServer,
      checkHealth: async () => {
        try {
          const res = await fetch(`${base}/api/health`);
          return res.ok;
        } catch {
          return false;
        }
      },
      onLog: (line) => console.log("[server]", line),
    },
    env,
  );

  window = new BrowserWindow({ width: 1100, height: 800, show: false });
  await window.loadURL(base);
  window.show();
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window?.hide();
    }
  });

  const autostart = app.getLoginItemSettings().openAtLogin;
  const tray = createTray(lan, autostart, {
    onOpen: () => {
      window?.show();
    },
    onRestart: () => {
      void restart();
    },
    onToggleAutostart: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
    onQuit: () => {
      quitting = true;
      app.quit();
    },
  });
  tray.on("double-click", () => window?.show());
}

async function restart(): Promise<void> {
  server?.stop();
  window?.reload();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => window?.show());
  app
    .whenReady()
    .then(boot)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "error desconocido";
      dialog.showErrorBox("No se pudo iniciar el sistema", message);
      app.quit();
    });
  app.on("before-quit", () => {
    quitting = true;
    server?.stop();
  });
  // La app vive en el tray: cerrar la ventana no cierra el proceso.
  app.on("window-all-closed", () => {});
}
