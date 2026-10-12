// @vitest-environment node
import { describe, expect, test } from "vitest";
import { pickLanAddress, lanUrl, type NetInterface } from "./lan";

const wifi: NetInterface[] = [
  { address: "192.168.1.5", family: "IPv4", internal: false },
  { address: "fe80::1", family: "IPv6", internal: false },
];
const loopback: NetInterface[] = [{ address: "127.0.0.1", family: "IPv4", internal: true }];

describe("pickLanAddress", () => {
  test("elige la primera IPv4 no interna", () => {
    expect(pickLanAddress({ en0: wifi, lo: loopback })).toBe("192.168.1.5");
  });
  test("null si solo hay loopback", () => {
    expect(pickLanAddress({ lo: loopback })).toBeNull();
  });
});

describe("lanUrl", () => {
  test("compone http://host:puerto", () => {
    expect(lanUrl("192.168.1.5", 3210)).toBe("http://192.168.1.5:3210");
  });
});
