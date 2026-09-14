import { NextResponse } from "next/server";
import { createProduct, listAllProducts } from "@/infra/db/menu-repository";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "true";
  const rows = await listAllProducts(activeOnly);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{
    categoryId: string;
    name: string;
    basePrice: string;
    description: string;
  }>;
  if (!body.categoryId || !body.name || !body.basePrice) {
    return NextResponse.json(
      { ok: false, error: { message: "Faltan campos" } },
      { status: 400 },
    );
  }
  const row = await createProduct({
    categoryId: body.categoryId,
    name: body.name,
    basePrice: body.basePrice,
    description: body.description,
  });
  return NextResponse.json({ ok: true, data: row });
}