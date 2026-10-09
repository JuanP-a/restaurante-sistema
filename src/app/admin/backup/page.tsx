import { getEnv } from "@/env";
import { getBackupSource } from "@/infra/db/client";
import { resolveDestinations } from "@/infra/backup/resolve-destinations";
import { listDrivesFromDrivelist } from "@/infra/backup/usb-destinations";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { BackupActions, type BackupListing } from "./backup-actions";

export default async function BackupPage() {
  if (!getBackupSource()) {
    return (
      <PageContainer>
        <PageHeading>Backups</PageHeading>
        <p className="mt-2 text-sm text-gray-500">
          Los backups solo están disponibles en la versión de escritorio.
        </p>
      </PageContainer>
    );
  }

  const destinations = await resolveDestinations({
    backupDir: getEnv().BACKUP_DIR,
    listDrives: listDrivesFromDrivelist,
  });

  const listings: BackupListing[] = [];
  for (const destination of destinations) {
    const listed = await destination.list();
    listings.push({
      id: destination.id,
      label: destination.label,
      backups: listed.ok ? listed.value.map((f) => ({ name: f.name, bytes: f.bytes })) : [],
    });
  }

  return (
    <PageContainer>
      <PageHeading>Backups</PageHeading>
      <p className="mb-6 mt-2 text-sm text-gray-500">
        Se guardan en la carpeta sincronizada y en las memorias USB conectadas.
      </p>
      <BackupActions destinations={listings} />
    </PageContainer>
  );
}
