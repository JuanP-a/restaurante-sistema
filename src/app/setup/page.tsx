import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSetupRequired } from "@/infra/settings/setup-state";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuración inicial · Restaurante" };

export default async function SetupPage() {
  if (!(await isSetupRequired())) redirect("/admin/orders");

  return (
    <PageContainer width="sm">
      <PageHeading>Bienvenido</PageHeading>
      <p className="mt-2 text-sm text-gray-500">
        Definí la contraseña que protegerá el panel del local. La vas a pedir al entrar.
      </p>
      <SetupForm />
    </PageContainer>
  );
}
