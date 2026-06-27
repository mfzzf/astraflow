import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "electron");
const appDir = path.join(rootDir, ".electron", "app");

const appPackage = {
  name: "better-astraflow-shell",
  version: "0.1.0",
  private: true,
  productName: "Better AstraFlow",
  main: "main.cjs",
  description: "Better AstraFlow desktop shell.",
};

await rm(appDir, { force: true, recursive: true });
await mkdir(appDir, { recursive: true });

await cp(path.join(sourceDir, "main.cjs"), path.join(appDir, "main.cjs"));
await cp(path.join(sourceDir, "preload.cjs"), path.join(appDir, "preload.cjs"));
await writeFile(
  path.join(appDir, "package.json"),
  `${JSON.stringify(appPackage, null, 2)}\n`
);

console.log("Prepared minimal Electron app shell.");
