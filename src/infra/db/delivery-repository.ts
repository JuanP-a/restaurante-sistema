import { asc, eq } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  colonias,
  deliveryZones,
  type Colonia,
  type DeliveryZone,
} from "@/infra/db/schema";

export async function listZones(_activeOnly = false): Promise<DeliveryZone[]> {
  const db = getDb();
  return db
    .select()
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.sortOrder));
}

export async function createZone(input: {
  name: string;
  cost: string;
}): Promise<DeliveryZone> {
  const db = getDb();
  const [row] = await db.insert(deliveryZones).values(input).returning();
  if (!row) throw new Error("createZone: insert returned no row");
  return row;
}

export async function updateZone(
  id: string,
  patch: Partial<Pick<DeliveryZone, "name" | "cost" | "active" | "sortOrder">>,
): Promise<DeliveryZone> {
  const db = getDb();
  const [row] = await db
    .update(deliveryZones)
    .set(patch)
    .where(eq(deliveryZones.id, id))
    .returning();
  if (!row) throw new Error(`updateZone: no zone with id ${id}`);
  return row;
}

export async function deleteZone(id: string): Promise<void> {
  const db = getDb();
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}

export type ColoniaWithZone = Colonia & {
  zoneName: string;
  zoneCost: string;
};

export async function listColoniasWithZone(): Promise<ColoniaWithZone[]> {
  const db = getDb();
  return db
    .select({
      id: colonias.id,
      name: colonias.name,
      zoneId: colonias.zoneId,
      active: colonias.active,
      zoneName: deliveryZones.name,
      zoneCost: deliveryZones.cost,
    })
    .from(colonias)
    .innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id));
}

export async function createColonia(input: {
  name: string;
  zoneId: string;
}): Promise<Colonia> {
  const db = getDb();
  const [row] = await db.insert(colonias).values(input).returning();
  if (!row) throw new Error("createColonia: insert returned no row");
  return row;
}

export async function updateColonia(
  id: string,
  patch: Partial<Pick<Colonia, "name" | "active">>,
): Promise<Colonia> {
  const db = getDb();
  const [row] = await db
    .update(colonias)
    .set(patch)
    .where(eq(colonias.id, id))
    .returning();
  if (!row) throw new Error(`updateColonia: no colonia with id ${id}`);
  return row;
}

export async function deleteColonia(id: string): Promise<void> {
  const db = getDb();
  await db.delete(colonias).where(eq(colonias.id, id));
}

export async function getColoniaDeliveryCost(
  coloniaId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ cost: deliveryZones.cost })
    .from(colonias)
    .innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id))
    .where(eq(colonias.id, coloniaId));
  return row?.cost ?? null;
}
