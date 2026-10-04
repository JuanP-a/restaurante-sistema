import { z } from "zod";

const envSchema = z
  .object({
    DB_DRIVER: z.enum(["pglite", "postgres"]).default("postgres"),
    DATABASE_URL: z.string().url().optional(),
    DB_PATH: z.string().default("./.data/pglite"),
    MIGRATIONS_PATH: z.string().default("./drizzle"),
    ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$10\$.+/, "debe ser hash bcrypt"),
    SESSION_SECRET: z.string().min(32, "mínimo 32 caracteres"),
    WHATSAPP_BSP_API_KEY: z.string().optional(),
    WHATSAPP_BSP_URL: z.string().url().default("https://waba-v2.360dialog.io"),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    BUSINESS_NAME: z.string().default("Mi Restaurante"),
    BUSINESS_ADDRESS: z.string().default(""),
    BUSINESS_PHONE: z.string().default(""),
    DEFAULT_PREP_TIME_MINUTES: z.coerce.number().int().min(1).default(25),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .superRefine((val, ctx) => {
    if (val.DB_DRIVER === "postgres" && !val.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL es obligatoria cuando DB_DRIVER=postgres",
      });
    }
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