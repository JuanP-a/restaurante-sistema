import { NextResponse } from "next/server";
import type { BackupFile } from "@/core/backup/types";
import { runBackup } from "./backup-service";
import { verifyBackup } from "./restore-verify";
import type { BackupDestination, BackupSource } from "./port";

export type BackupDeps = {
  getSource: () => BackupSource | null;
  resolveDestinations: () => Promise<BackupDestination[]>;
  keep: () => number;
  now: () => Date;
};

type DestinationListing = { id: string; label: string; backups: BackupFile[] };

async function listDestinations(
  destinations: BackupDestination[],
): Promise<DestinationListing[]> {
  const listings: DestinationListing[] = [];
  for (const destination of destinations) {
    const listed = await destination.list();
    listings.push({
      id: destination.id,
      label: destination.label,
      backups: listed.ok ? listed.value : [],
    });
  }
  return listings;
}

function parseRestoreBody(body: unknown): { destinationId: string; name: string } | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("destinationId" in body) || !("name" in body)) return null;
  const { destinationId, name } = body;
  if (typeof destinationId !== "string" || typeof name !== "string") return null;
  if (!destinationId || !name) return null;
  return { destinationId, name };
}

export function createBackupRoutes(deps: BackupDeps): {
  GET: () => Promise<Response>;
  POST: () => Promise<Response>;
} {
  async function GET(): Promise<Response> {
    if (!deps.getSource()) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const destinations = await listDestinations(await deps.resolveDestinations());
    return NextResponse.json({ ok: true, data: { destinations } });
  }

  async function POST(): Promise<Response> {
    const source = deps.getSource();
    if (!source) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const destinations = await deps.resolveDestinations();
    const result = await runBackup({ source, destinations, keep: deps.keep(), now: deps.now() });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { message: `No se pudo crear el backup: ${result.error.kind}` } },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: result.value });
  }

  return { GET, POST };
}

export function createRestoreRoute(
  deps: Pick<BackupDeps, "getSource" | "resolveDestinations">,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!deps.getSource()) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const body = parseRestoreBody(await req.json());
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { message: "destinationId y name son requeridos" } },
        { status: 400 },
      );
    }
    const destinations = await deps.resolveDestinations();
    const destination = destinations.find((d) => d.id === body.destinationId);
    if (!destination) {
      return NextResponse.json(
        { ok: false, error: { message: "Destino no encontrado" } },
        { status: 400 },
      );
    }
    const sql = await destination.read(body.name);
    if (!sql.ok) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no encontrado" } },
        { status: 400 },
      );
    }
    const verified = await verifyBackup(sql.value);
    if (!verified.ok) {
      const detail = "message" in verified.error ? verified.error.message : verified.error.kind;
      return NextResponse.json(
        { ok: false, error: { message: `Backup no restaurable: ${detail}` } },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: verified.value });
  };
}
