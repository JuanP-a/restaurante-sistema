import { getEnv } from "@/env";

export type InteractiveListSection = {
  title: string;
  rows: { id: string; title: string; description?: string }[];
};

export type SendListBody = {
  text: string;
  buttonText: string;
  sections: InteractiveListSection[];
};

export type SendButtonsBody = {
  text: string;
  buttons: { id: string; title: string }[];
};

async function postMessage(body: Record<string, unknown>): Promise<void> {
  const env = getEnv();
  const res = await fetch(`${env.WHATSAPP_BSP_URL}/messages`, {
    method: "POST",
    headers: {
      authorization: env.WHATSAPP_BSP_API_KEY ?? "",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
}

export async function sendText(to: string, text: string): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} text=${text}`);
    return;
  }
  await postMessage({ to, type: "text", text: { body: text } });
}

export async function sendList(to: string, body: SendListBody): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} list=${JSON.stringify(body)}`);
    return;
  }
  await postMessage({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.text },
      action: { button: body.buttonText, sections: body.sections },
    },
  });
}

export async function sendButtons(
  to: string,
  body: SendButtonsBody,
): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} buttons=${JSON.stringify(body)}`);
    return;
  }
  await postMessage({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.text },
      action: {
        buttons: body.buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}
