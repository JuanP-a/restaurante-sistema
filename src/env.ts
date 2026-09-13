import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$10\$/, "debe ser hash bcrypt"),
  SESSION_SECRET: z.string().min(32, "mínimo 32 caracteres"),
  WHATSAPP_BSP_API_KEY: z.string().min(1).optional(),
  WHATSAPP_BSP_URL: z.string().url().default("https://waba-v2.360dialog.io"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  BUSINESS_NAME: z.string().default("Mi Restaurante"),
  BUSINESS_ADDRESS: z.string().default(""),
  BUSINESS_PHONE: z.string().default(""),
  DEFAULT_PREP_TIME_MINUTES: z.coerce.number().int().min(1).default(25),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

let cached: Env | null = null;
export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}