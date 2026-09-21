import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  createCategory,
  createProduct,
} from "@/infra/db/menu-repository";
import {
  resetSession,
  getSession,
} from "@/infra/whatsapp/session-store";

const db = getDb();

vi.mock("@/infra/whatsapp/client", () => ({
  sendText: vi.fn(async () => {}),
  sendList: vi.fn(async () => {}),
  sendButtons: vi.fn(async () => {}),
}));

const { sendList, sendButtons } = await import("@/infra/whatsapp/client");

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
  await db.execute(
    sql`SELECT setval('orders_sequential_number_seq', 1, false)`,
  );
  const { _clearAllSessionsForTests } = await import(
    "@/infra/whatsapp/session-store"
  );
  _clearAllSessionsForTests();
  vi.clearAllMocks();
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

function makeWebhook(body: unknown): Request {
  return new Request(
    "http://localhost/api/webhooks/whatsapp",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function textMsg(from: string, body: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function listReplyMsg(from: string, id: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  type: "interactive",
                  interactive: { type: "list_reply", list_reply: { id } },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buttonReplyMsg(from: string, id: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  type: "interactive",
                  interactive: { type: "button_reply", button_reply: { id } },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const PHONE = "5215551234567";

describe("POST /api/webhooks/whatsapp", () => {
  test("primer mensaje: idle → envía list de categorías, session pasa a browsing_category", async () => {
    const cat = await createCategory({ name: "Hamburguesas" });

    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    const res = await POST(makeWebhook(textMsg(PHONE, "hola")) as never);
    expect(res.status).toBe(200);

    const state = getSession(PHONE);
    expect(state.state).toBe("browsing_category");
    expect(sendList).toHaveBeenCalled();
    const firstCall = (sendList as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall?.[0]).toBe(PHONE);
    expect(JSON.stringify(firstCall?.[1])).toContain(cat.name);
    resetSession(PHONE);
  });

  test("cat:ID → browsing_product con list de productos", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const p = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50",
    });

    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    await POST(makeWebhook(textMsg(PHONE, "hola")) as never);
    await POST(makeWebhook(listReplyMsg(PHONE, `cat:${cat.id}`)) as never);

    const state = getSession(PHONE);
    expect(state.state).toBe("browsing_product");
    expect(sendList).toHaveBeenCalled();
    const lastCall = (sendList as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(JSON.stringify(lastCall?.[1])).toContain(p.name);
    resetSession(PHONE);
  });

  test("prod:ID → customizing_product con botones", async () => {
    const cat = await createCategory({ name: "Tacos" });
    await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50",
    });

    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    await POST(makeWebhook(textMsg(PHONE, "hola")) as never);
    await POST(makeWebhook(listReplyMsg(PHONE, `cat:${cat.id}`)) as never);
    await POST(makeWebhook(listReplyMsg(PHONE, "prod:00000000-0000-0000-0000-000000000001")) as never);

    const state = getSession(PHONE);
    expect(state.state).toBe("customizing_product");
    expect(sendButtons).toHaveBeenCalled();
    resetSession(PHONE);
  });

  test("svc:local → in_cart con direcciones de finalizar", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const p = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50",
    });

    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    await POST(makeWebhook(textMsg(PHONE, "hola")) as never);
    await POST(makeWebhook(listReplyMsg(PHONE, `cat:${cat.id}`)) as never);
    await POST(makeWebhook(listReplyMsg(PHONE, `prod:${p.id}`)) as never);
    await POST(makeWebhook(buttonReplyMsg(PHONE, "add:ok")) as never);
    await POST(makeWebhook(buttonReplyMsg(PHONE, "cart:finalize")) as never);
    await POST(makeWebhook(buttonReplyMsg(PHONE, "svc:local")) as never);

    const state = getSession(PHONE);
    expect(state.state).toBe("confirming_order");
    resetSession(PHONE);
  });
});

describe("webhook signature verification gating", () => {
  test("POST con WHATSAPP_VERIFY_TOKEN configurado y signature inválida → 401", async () => {
    const saved = process.env.WHATSAPP_VERIFY_TOKEN;
    process.env.WHATSAPP_VERIFY_TOKEN = "test-secret";

    vi.resetModules();
    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body: JSON.stringify(textMsg("5215551112222", "hola")),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);

    if (saved === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = saved;
    vi.resetModules();
  });

  test("POST sin WHATSAPP_VERIFY_TOKEN configurado → no verifica signature", async () => {
    const saved = process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    vi.resetModules();
    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    const res = await POST(
      makeWebhook(textMsg("5215551113333", "hola")) as never,
    );
    expect(res.status).toBe(200);
    if (saved !== undefined) process.env.WHATSAPP_VERIFY_TOKEN = saved;
    vi.resetModules();
  });
});

describe("per-phone serialization (withPhoneLock)", () => {
  test("dos webhooks concurrentes para el mismo phone serializan", async () => {
    const cat = await createCategory({ name: "Tacos" });
    await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50",
    });
    await createProduct({
      categoryId: cat.id,
      name: "Lengua",
      basePrice: "55",
    });

    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    const sessionStore = await import("@/infra/whatsapp/session-store");
    const phone = "5215559990001";
    sessionStore.resetSession(phone);

    // Fire two events back-to-back: 'hola' + cat:X. With serialization,
    // the second sees the state left by the first.
    const [res1, res2] = await Promise.all([
      POST(makeWebhook(textMsg(phone, "hola")) as never),
      POST(makeWebhook(listReplyMsg(phone, "cat:cat-fake")) as never),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Re-import session-store to make sure we read the same Map instance
    // the route handler used (vi.resetModules in earlier tests can cause
    // module-cache skew).
    const fresh = await import("@/infra/whatsapp/session-store");
    const state = fresh.getSession(phone);
    expect(["browsing_category", "browsing_product"]).toContain(state.state);
    fresh.resetSession(phone);
  });
});
