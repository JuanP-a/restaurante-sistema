import { NextResponse } from "next/server";
import { deleteCategory, updateCategory } from "@/infra/db/menu-repository";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const patch = (await req.json()) as Record<string, unknown>;
  const row = await updateCategory(id, patch as Parameters<typeof updateCategory>[1]);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await deleteCategory(id);
  return NextResponse.json({ ok: true });
}