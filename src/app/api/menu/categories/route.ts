import { NextResponse } from "next/server";
import { createCategory, listCategories } from "@/infra/db/menu-repository";

export async function GET() {
  const rows = await listCategories();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: unknown; sortOrder?: number };
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json(
      { ok: false, error: { message: "Falta nombre" } },
      { status: 400 },
    );
  }
  const row = await createCategory({ name: body.name, sortOrder: body.sortOrder });
  return NextResponse.json({ ok: true, data: row });
}