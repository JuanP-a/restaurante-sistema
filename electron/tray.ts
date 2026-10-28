import { Menu, Tray, nativeImage } from "electron";

export type TrayActions = {
  onOpen: () => void;
  onRestart: () => void;
  onToggleAutostart: (enabled: boolean) => void;
  onQuit: () => void;
};

export function createTray(
  lanUrl: string | null,
  autostart: boolean,
  actions: TrayActions,
): Tray {
  const tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Sistema de pedidos");
  const menu = Menu.buildFromTemplate([
    { label: "Abrir panel", click: actions.onOpen },
    { label: lanUrl ? `LAN: ${lanUrl}` : "LAN: (sin red)", enabled: false },
    { type: "separator" },
    { label: "Reiniciar servidor", click: actions.onRestart },
    {
      label: "Iniciar con Windows",
      type: "checkbox",
      checked: autostart,
      click: (item) => actions.onToggleAutostart(item.checked),
    },
    { type: "separator" },
    { label: "Salir", click: actions.onQuit },
  ]);
  tray.setContextMenu(menu);
  return tray;
}
