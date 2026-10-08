import { describe, expect, test } from "vitest";
import { ESC, GS, align, bold, cut, doubleSize, feed, init, selectCp850 } from "./escpos-bytes";

describe("escpos-bytes", () => {
  test("init y selectCp850", () => {
    expect(init()).toEqual([ESC, 0x40]);
    expect(selectCp850()).toEqual([ESC, 0x74, 0x02]);
  });

  test("align mapea izquierda/centro/derecha", () => {
    expect(align("left")).toEqual([ESC, 0x61, 0x00]);
    expect(align("center")).toEqual([ESC, 0x61, 0x01]);
    expect(align("right")).toEqual([ESC, 0x61, 0x02]);
  });

  test("bold on/off", () => {
    expect(bold(true)).toEqual([ESC, 0x45, 0x01]);
    expect(bold(false)).toEqual([ESC, 0x45, 0x00]);
  });

  test("doubleSize on/off", () => {
    expect(doubleSize(true)).toEqual([GS, 0x21, 0x11]);
    expect(doubleSize(false)).toEqual([GS, 0x21, 0x00]);
  });

  test("feed con cantidad y corte completo", () => {
    expect(feed()).toEqual([ESC, 0x64, 0x01]);
    expect(feed(3)).toEqual([ESC, 0x64, 0x03]);
    expect(cut()).toEqual([GS, 0x56, 0x00]);
  });
});
