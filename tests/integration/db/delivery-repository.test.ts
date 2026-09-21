import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  listZones,
  createZone,
  updateZone,
  deleteZone,
  listColoniasWithZone,
  createColonia,
  updateColonia,
  deleteColonia,
} from "@/infra/db/delivery-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

describe("delivery repository / zones", () => {
  test("createZone persiste y devuelve fila con defaults", async () => {
    const row = await createZone({ name: "Centro", cost: "20.00" });
    expect(row.id).toBeTypeOf("string");
    expect(row.name).toBe("Centro");
    expect(row.cost).toBe("20.00");
    expect(row.active).toBe(true);
    expect(row.sortOrder).toBe(0);
  });

  test("listZones ordena por sortOrder", async () => {
    await createZone({ name: "B", cost: "20.00" });
    await createZone({ name: "A", cost: "15.00" });
    const rows = await listZones();
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { name: string }) => r.name)).toEqual(["B", "A"]);
  });

  test("updateZone aplica patch parcial", async () => {
    const z = await createZone({ name: "Centro", cost: "20.00" });
    const updated = await updateZone(z.id, { cost: "25.00", active: false });
    expect(updated.cost).toBe("25.00");
    expect(updated.active).toBe(false);
    expect(updated.name).toBe("Centro");
  });

  test("deleteZone borra y cascadea colonias", async () => {
    const z = await createZone({ name: "Centro", cost: "20.00" });
    const c = await createColonia({ name: "Roma", zoneId: z.id });
    await deleteZone(z.id);
    const remainingZones = await listZones();
    const remainingColonias = await listColoniasWithZone();
    expect(remainingZones).toHaveLength(0);
    expect(remainingColonias).toHaveLength(0);
    void c;
  });
});

describe("delivery repository / colonias", () => {
  test("createColonia + listColoniasWithZone retorna join con zoneName/zoneCost", async () => {
    const z = await createZone({ name: "Centro", cost: "20.00" });
    await createColonia({ name: "Roma", zoneId: z.id });
    await createColonia({ name: "Condesa", zoneId: z.id });

    const rows = await listColoniasWithZone();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe("Roma");
    expect(rows[0]?.zoneName).toBe("Centro");
    expect(rows[0]?.zoneCost).toBe("20.00");
  });

  test("updateColonia aplica patch parcial", async () => {
    const z = await createZone({ name: "Centro", cost: "20.00" });
    const c = await createColonia({ name: "Roma", zoneId: z.id });
    const updated = await updateColonia(c.id, { active: false });
    expect(updated.active).toBe(false);
    expect(updated.name).toBe("Roma");
  });

  test("deleteColonia borra fila", async () => {
    const z = await createZone({ name: "Centro", cost: "20.00" });
    const c = await createColonia({ name: "Roma", zoneId: z.id });
    await deleteColonia(c.id);
    const rows = await listColoniasWithZone();
    expect(rows).toHaveLength(0);
  });
});
