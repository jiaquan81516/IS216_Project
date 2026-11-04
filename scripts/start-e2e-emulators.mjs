import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { assertSafeE2EEnvironment, emulatorEnvironment, E2E_PROJECT_ID } from "./e2e-env.mjs";

assertSafeE2EEnvironment(process.env);

function inspectJava(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  const match = output.match(/version\s+"(?:1\.)?(\d+)/i);
  return {
    command,
    major: match ? Number.parseInt(match[1], 10) : Number.NaN,
    available: !result.error && result.status === 0,
  };
}

let java = inspectJava("java");

if (!java.available || java.major < 21) {
  const candidates = process.platform === "darwin"
    ? ["/opt/homebrew/opt/openjdk@21/bin/java", "/usr/local/opt/openjdk@21/bin/java"]
    : [];
  const compatibleJava = candidates
    .filter((candidate) => existsSync(candidate))
    .map(inspectJava)
    .find((candidate) => candidate.available && candidate.major >= 21);
  if (compatibleJava) java = compatibleJava;
}

if (!java.available || !Number.isInteger(java.major) || java.major < 21) {
  const detectedVersion = Number.isInteger(java.major) ? `Java ${java.major}` : "no usable Java installation";
  console.error(
    `Firebase E2E prerequisite mismatch: Java 21 or newer is required, but ${detectedVersion} is active. ` +
    "Install/select JDK 21+, verify with `java -version`, then run `pnpm test:e2e` again.",
  );
  process.exit(1);
}

// A leftover emulator from an earlier run makes Firebase exit with no useful message, so say it here.
const PORTS = [[4400, "emulator hub"], [8080, "Firestore"], [9099, "Auth"], [4000, "emulator UI"]];
function portFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => done(true)));
  });
}
const busy = [];
for (const [port, label] of PORTS) if (!(await portFree(port))) busy.push(`${port} (${label})`);
if (busy.length) {
  const lookup = PORTS.map(([port]) => `-iTCP:${port}`).join(" ");
  console.error(
    `Firebase E2E ports already in use: ${busy.join(", ")}. It may be an emulator left over from an earlier run, or another app. ` +
    `Find the owner with \`lsof -nP ${lookup} -sTCP:LISTEN\`, then stop it with \`kill <PID>\` and run \`pnpm test:e2e\` again.`,
  );
  process.exit(1);
}

const childEnvironment = emulatorEnvironment();
if (java.command !== "java") {
  const javaBinDirectory = dirname(resolve(java.command));
  childEnvironment.JAVA_HOME = resolve(javaBinDirectory, "..");
  childEnvironment.PATH = `${javaBinDirectory}${process.platform === "win32" ? ";" : ":"}${childEnvironment.PATH ?? ""}`;
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "firebase", "emulators:start", "--only", "auth,firestore", "--project", E2E_PROJECT_ID],
  { env: childEnvironment, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  if (code) console.error(`Firebase emulators exited with code ${code}. See the output above and firebase-debug.log.`);
  process.exitCode = signal ? 1 : (code ?? 1);
});
