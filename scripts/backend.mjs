import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The uv installer uses ~/.local/bin, which may not be on an IDE's PATH yet.
const installedUv = join(homedir(), ".local", "bin", "uv");
const uv = existsSync(installedUv) ? installedUv : "uv";
const child = spawn(uv, process.argv.slice(2), {
  cwd: fileURLToPath(new URL("../backend/", import.meta.url)),
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(
    `Could not run uv: ${error.message}.\n` +
      "Install uv (https://docs.astral.sh/uv/getting-started/installation/), then run `npm install` again.",
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
