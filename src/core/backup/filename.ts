const BACKUP_NAME = /^restaurante-\d{4}-\d{2}-\d{2}-\d{4}\.sql$/;

const pad = (n: number): string => String(n).padStart(2, "0");

export function backupFileName(now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `restaurante-${date}-${time}.sql`;
}

export function isBackupFileName(name: string): boolean {
  return BACKUP_NAME.test(name);
}
