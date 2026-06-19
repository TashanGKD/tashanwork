import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repoRoot, "skills", "tashan-prebuilt");

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function isInside(parent, child) {
  const parentPath = resolve(parent).toLowerCase();
  const childPath = resolve(child).toLowerCase();
  return childPath === parentPath || childPath.startsWith(`${parentPath}\\`) || childPath.startsWith(`${parentPath}/`);
}

const workspace = readArg("--workspace") ?? process.env.TASHAN_WORKSPACE ?? null;
const namespace = readArg("--namespace") ?? "tashan";
const dryRun = hasFlag("--dry-run");

if (!workspace) {
  console.error("Usage: node scripts/tashan-seed-skills.mjs --workspace <path> [--namespace tashan] [--dry-run]");
  process.exit(2);
}

const workspaceRoot = resolve(workspace);
const installRoot = join(workspaceRoot, ".opencode", "skills", namespace);

if (!isInside(workspaceRoot, installRoot)) {
  throw new Error(`Refusing to install outside workspace: ${installRoot}`);
}

const entries = await readdir(sourceRoot, { withFileTypes: true });
const installed = [];

if (!dryRun) {
  await mkdir(installRoot, { recursive: true });
}

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const source = join(sourceRoot, entry.name);
  const skillFile = join(source, "SKILL.md");
  try {
    const info = await stat(skillFile);
    if (!info.isFile()) continue;
  } catch {
    continue;
  }
  const destination = join(installRoot, entry.name);
  if (!isInside(installRoot, destination)) {
    throw new Error(`Refusing unsafe skill path: ${destination}`);
  }
  if (!dryRun) {
    await cp(source, destination, { recursive: true, force: true });
  }
  installed.push({
    name: entry.name,
    destination,
  });
}

console.log(JSON.stringify({
  workspace: workspaceRoot,
  namespace,
  dryRun,
  installedCount: installed.length,
  installed,
}, null, 2));
