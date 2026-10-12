import type { Metadata } from "next";
import { getEnv } from "@/env";
import { Card } from "@/ui/Card";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { QrCode } from "./qr";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conectar celular · Restaurante" };

export default function ConectarPage() {
  const url = getEnv().DESKTOP_LAN_URL;

  return (
    <PageContainer>
      <PageHeading>Conectar celular</PageHeading>
      {!url ? (
        <p className="mt-2 text-sm text-gray-500">
          Esta pantalla está disponible solo en la versión de escritorio.
        </p>
      ) : (
        <>
          <p className="mb-4 mt-2 text-sm text-gray-500">
            Escaneá el código con el celular (misma red WiFi) para abrir el panel.
          </p>
          <Card className="flex flex-col items-center gap-3 p-6">
            <QrCode value={url} />
            <code className="break-all text-sm">{url}</code>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
