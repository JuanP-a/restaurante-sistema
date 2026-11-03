import type { Metadata } from "next";
import { getEnv } from "@/env";
import { loadPrinterConfig } from "@/infra/printer/index";
import { realPrinterRouteDeps } from "@/infra/printer/http-routes";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { PrinterForm } from "./printer-form";

// Lee la DB y el env en runtime; sin esto el build prerenderiza el branch
// "solo escritorio" como HTML estático y la sección desaparece en el .exe.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ajustes · Restaurante" };

export default async function AjustesPage() {
  if (!realPrinterRouteDeps().isDesktop()) {
    return (
      <PageContainer width="sm">
        <PageHeading>Ajustes</PageHeading>
        <p className="mt-2 text-sm text-gray-500">
          Los ajustes de impresora solo están disponibles en la versión de escritorio.
        </p>
      </PageContainer>
    );
  }

  const config = await loadPrinterConfig(getEnv());
  return (
    <PageContainer width="sm">
      <PageHeading>Ajustes</PageHeading>
      <section aria-labelledby="impresora" className="mt-4 space-y-3">
        <h2 id="impresora" className="text-sm font-semibold">
          Impresora
        </h2>
        <p className="text-sm text-gray-500">
          Impresora térmica de red (Ethernet) con IP fija. Si dejas la IP vacía, las comandas se
          imprimen desde el navegador.
        </p>
        <PrinterForm initial={{ host: config.PRINTER_HOST, port: String(config.PRINTER_PORT) }} />
      </section>
    </PageContainer>
  );
}
