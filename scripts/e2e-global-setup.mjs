import { mkdir } from "node:fs/promises";
import { seedE2E } from "./seed-e2e.mjs";

export default async function globalSetup() {
  await mkdir("__tests__/e2e/.auth", { recursive: true });
  await seedE2E();
}
