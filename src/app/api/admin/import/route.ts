import { NextResponse } from "next/server";
import { parseMenuImport } from "@/core/menu/parse-import";
import { importMenu, type ImportMode } from "@/infra/db/menu-repository";

function parseMode(value: unknown): ImportMode {
  return value === "replace" ? "replace" : "append";
}

export async function POST(req: Request) {
  let body: { menu?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as { menu?: unknown; mode?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "JSON malformado" } },
      { status: 400 },
    );
  }

  const parsed = parseMenuImport(body.menu);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: parsed.error.message,
          path: "path" in parsed.error ? parsed.error.path : undefined,
        },
      },
      { status: 422 },
    );
  }

  const report = await importMenu(parsed.value, { mode: parseMode(body.mode) });
  return NextResponse.json({ ok: true, data: report });
}
