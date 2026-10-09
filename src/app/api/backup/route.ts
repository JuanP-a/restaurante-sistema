import { createBackupRoutes } from "@/infra/backup/http-routes";
import { realBackupDeps } from "@/infra/backup/deps";

const routes = createBackupRoutes(realBackupDeps());

export const GET = routes.GET;
export const POST = routes.POST;
