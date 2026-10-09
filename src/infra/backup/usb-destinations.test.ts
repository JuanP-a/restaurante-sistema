import { describe, expect, test } from "vitest";
import { selectUsbMounts, type DriveInfo } from "./usb-destinations";

function drive(overrides: Partial<DriveInfo>): DriveInfo {
  return {
    isRemovable: false,
    isUSB: null,
    isReadOnly: false,
    mountpoints: [{ path: "/mnt/x" }],
    ...overrides,
  };
}

describe("selectUsbMounts", () => {
  test("incluye unidades removibles y USB", () => {
    const drives = [
      drive({ isRemovable: true, mountpoints: [{ path: "/media/usb" }] }),
      drive({ isUSB: true, mountpoints: [{ path: "E:" }] }),
    ];
    expect(selectUsbMounts(drives)).toEqual(["/media/usb", "E:"]);
  });

  test("ignora discos de sistema, read-only y sin mountpoint", () => {
    const drives = [
      drive({ mountpoints: [{ path: "/" }] }),
      drive({ isRemovable: true, isReadOnly: true }),
      drive({ isRemovable: true, mountpoints: [] }),
    ];
    expect(selectUsbMounts(drives)).toEqual([]);
  });
});
