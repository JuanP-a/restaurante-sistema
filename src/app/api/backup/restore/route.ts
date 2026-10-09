import { createRestoreRoute } from "@/infra/backup/http-routes";
import { realBackupDeps } from "@/infra/backup/deps";

const deps = realBackupDeps();

export const POST = createRestoreRoute({
  getSource: deps.getSource,
  resolveDestinations: deps.resolveDestinations,
});
