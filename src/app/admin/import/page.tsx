import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { ImportForm } from "./import-form";

export default function ImportPage() {
  return (
    <PageContainer>
      <PageHeading>Importar menú</PageHeading>
      <p className="mb-6 mt-2 text-sm text-gray-500">
        Subí un archivo JSON con el formato documentado en docs/import/README.md.
      </p>
      <ImportForm />
    </PageContainer>
  );
}
