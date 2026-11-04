import { spawn } from "node:child_process";
import process from "node:process";
import { assertSafeE2EEnvironment, AUTH_HOST, emulatorEnvironment, FIRESTORE_HOST, waitForUrl } from "./e2e-env.mjs";

assertSafeE2EEnvironment(process.env);

try {
  await Promise.all([
    waitForUrl(`http://${AUTH_HOST}/`, "Firebase Auth Emulator"),
    waitForUrl(`http://${FIRESTORE_HOST}/`, "Firestore Emulator"),
  ]);
} catch (error) {
  console.error(`Refusing to start the E2E app: ${error.message}`);
  process.exit(1);
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "vite", "--mode", "e2e", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { env: emulatorEnvironment(), stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exitCode = signal ? 1 : (code ?? 1));
