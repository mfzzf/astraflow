import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const publicDir = path.join(rootDir, "public");
const nextStaticDir = path.join(rootDir, ".next", "static");
const standalonePublicDir = path.join(standaloneDir, "public");
const standaloneStaticDir = path.join(standaloneDir, ".next", "static");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standaloneServer))) {
  console.error(
    "Missing .next/standalone/server.js. Run `bun run build` before preparing the Electron package.",
  );
  process.exit(1);
}

if (await exists(publicDir)) {
  await rm(standalonePublicDir, { force: true, recursive: true });
  await cp(publicDir, standalonePublicDir, { recursive: true });
}

if (await exists(nextStaticDir)) {
  await rm(standaloneStaticDir, { force: true, recursive: true });
  await cp(nextStaticDir, standaloneStaticDir, { recursive: true });
}

console.log("Prepared Next standalone assets for Electron packaging.");
