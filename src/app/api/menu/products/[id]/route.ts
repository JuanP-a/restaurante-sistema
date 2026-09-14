import { NextResponse } from "next/server";
import { deleteProduct, getProduct, updateProduct } from "@/infra/db/menu-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const row = await getProduct(id);
  if (!row) {
    return NextResponse.json({ ok: false, error: { message: "No existe" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: row });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const patch = (await req.json()) as Record<string, unknown>;
  const row = await updateProduct(id, patch as Parameters<typeof updateProduct>[1]);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}