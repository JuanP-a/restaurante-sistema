// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createBackupRoutes, createRestoreRoute } from "@/infra/backup/http-routes";
import { createFakeDestination, createFakeSource } from "@/infra/backup/fake";
import type { BackupDeps } from "@/infra/backup/http-routes";

const NOW = new Date(2026, 9, 8, 3, 0);

function deps(overrides: Partial<BackupDeps> = {}): BackupDeps {
  return {
    getSource: () => createFakeSource("CREATE TABLE orders (id int);"),
    resolveDestinations: async () => [createFakeDestination({ id: "folder", label: "Carpeta" })],
    keep: () => 7,
    now: () => NOW,
    ...overrides,
  };
}

describe("POST /api/backup", () => {
  test("crea el backup y responde ok", async () => {
    const { POST } = createBackupRoutes(deps());
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data?: { name: string } };
    expect(body.ok).toBe(true);
    expect(body.data?.name).toBe("restaurante-2026-10-08-0300.sql");
  });

  test("409 sin fuente (modo cloud)", async () => {
    const { POST } = createBackupRoutes(deps({ getSource: () => null }));
    expect((await POST()).status).toBe(409);
  });
});

describe("GET /api/backup", () => {
  test("lista los backups por destino", async () => {
    const { GET } = createBackupRoutes(deps());
    const res = await GET();
    const body = (await res.json()) as { data?: { destinations: { id: string }[] } };
    expect(res.status).toBe(200);
    expect(body.data?.destinations[0]?.id).toBe("folder");
  });
});

describe("POST /api/backup/restore", () => {
  test("valida un backup y reporta los conteos", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    await dest.write(
      "restaurante-2026-10-08-0300.sql",
      new TextEncoder().encode(
        "CREATE TABLE orders (id int); CREATE TABLE products (id int); CREATE TABLE categories (id int); INSERT INTO orders VALUES (1);",
      ),
    );
    const handler = createRestoreRoute({
      getSource: () => createFakeSource("x"),
      resolveDestinations: async () => [dest],
    });

    const res = await handler(
      new Request("http://test/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ destinationId: "folder", name: "restaurante-2026-10-08-0300.sql" }),
      }),
    );
    const body = (await res.json()) as { ok: boolean; data?: { tables: { rows: number }[] } };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("400 si el backup no existe", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const handler = createRestoreRoute({
      getSource: () => createFakeSource("x"),
      resolveDestinations: async () => [dest],
    });
    const res = await handler(
      new Request("http://test/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ destinationId: "folder", name: "nope.sql" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
