import { getEnv } from "@/env";
import { requiresSetup } from "@/core/settings/setup";
import { getAdminPasswordHash } from "@/infra/db/settings-repository";

export async function isSetupRequired(): Promise<boolean> {
  return requiresSetup((await getAdminPasswordHash()) !== null, getEnv().ADMIN_PASSWORD_HASH);
}
