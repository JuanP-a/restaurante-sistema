#!/usr/bin/env node
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Contraseña a hashear: ");
await rl.close();

if (!password) {
  console.error("Falta la contraseña");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log("\nHash (pegalo en ADMIN_PASSWORD_HASH en .env.local):\n");
console.log(hash);
console.log();