export const ESC = 0x1b;
export const GS = 0x1d;

export function init(): number[] {
  return [ESC, 0x40];
}

export function selectCp850(): number[] {
  return [ESC, 0x74, 0x02];
}

export function align(position: "left" | "center" | "right"): number[] {
  const value = position === "left" ? 0x00 : position === "center" ? 0x01 : 0x02;
  return [ESC, 0x61, value];
}

export function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 0x01 : 0x00];
}

export function doubleSize(on: boolean): number[] {
  return [GS, 0x21, on ? 0x11 : 0x00];
}

export function feed(lines = 1): number[] {
  return [ESC, 0x64, lines];
}

export function cut(): number[] {
  return [GS, 0x56, 0x00];
}
