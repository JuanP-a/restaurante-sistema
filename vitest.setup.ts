import { config } from "dotenv";
config({ path: ".env.local", override: false });

// dotenv keeps `\$` literal in double-quoted strings, but Next.js (via
// dotenv-expand) processes escape sequences so `$VAR` references aren't
// truncated. Strip the literal backslashes that protect `$` characters so
// tests see the same shape as production.
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === "string" && value.includes("\\$")) {
    process.env[key] = value.replace(/\\\$/g, "$");
  }
}