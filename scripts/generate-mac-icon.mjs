import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const run = promisify(execFile);
const rootDir = process.cwd();
const sourceIcon = path.join(rootDir, "favicon.ico");
const buildDir = path.join(rootDir, "build");
const iconsetDir = path.join(buildDir, "icon.iconset");
const outputIcon = path.join(buildDir, "icon.icns");

const sizes = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

await rm(iconsetDir, { force: true, recursive: true });
await mkdir(iconsetDir, { recursive: true });

for (const [filename, size] of sizes) {
  await run("sips", ["-z", String(size), String(size), sourceIcon, "--out", path.join(iconsetDir, filename)]);
}

await run("iconutil", ["-c", "icns", iconsetDir, "-o", outputIcon]);
await rm(iconsetDir, { force: true, recursive: true });

console.log(`Generated ${path.relative(rootDir, outputIcon)}.`);
