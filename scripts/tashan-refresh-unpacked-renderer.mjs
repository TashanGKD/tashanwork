import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDist = join(repoRoot, "apps", "app", "dist");
const unpackedRoot = join(repoRoot, "apps", "desktop", "dist-electron", "win-unpacked");
const preferredUnpackedExe = join(unpackedRoot, "TashanWork.exe");
const legacyUnpackedExe = join(unpackedRoot, "TaShan Enterprise AI Workbench.exe");
const unpackedExe = existsSync(preferredUnpackedExe) ? preferredUnpackedExe : legacyUnpackedExe;
const unpackedAppDist = join(unpackedRoot, "resources", "app-dist");
const unpackedAsar = join(unpackedRoot, "resources", "app.asar");
const desktopMainSource = join(repoRoot, "apps", "desktop", "electron", "main.mjs");

const summaryArgIndex = process.argv.indexOf("--summary");
const summaryPath = summaryArgIndex >= 0 && process.argv[summaryArgIndex + 1]
  ? resolve(process.argv[summaryArgIndex + 1])
  : null;
const skipTypecheck = process.argv.includes("--skip-typecheck");

function run(command, args, options = {}) {
  const startedAt = Date.now();
  const spawnCommand = process.platform === "win32" && /\.(cmd|bat)$/i.test(command)
    ? process.env.ComSpec || "cmd.exe"
    : command;
  const spawnArgs = spawnCommand !== command
    ? ["/d", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const elapsedMs = Date.now() - startedAt;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1} after ${elapsedMs}ms`);
  }
  return elapsedMs;
}

function assertInsideRepo(target, label) {
  const normalizedRoot = `${repoRoot}${sep}`;
  const normalizedTarget = resolve(target);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error(`${label} is outside repo: ${normalizedTarget}`);
  }
}

function readRendererText() {
  const assetsDir = join(unpackedAppDist, "assets");
  return readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(assetsDir, name), "utf8"))
    .join("\n");
}

async function refreshUnpackedElectronMain() {
  const startedAt = Date.now();
  assertInsideRepo(unpackedAsar, "unpackedAsar");
  assertInsideRepo(desktopMainSource, "desktopMainSource");
  if (!existsSync(unpackedAsar)) {
    throw new Error(`Unpacked app.asar not found: ${unpackedAsar}`);
  }
  const asar = require(join(repoRoot, "node_modules", ".pnpm", "@electron+asar@3.4.1", "node_modules", "@electron", "asar"));
  const tempDir = join(repoRoot, ".tmp", `tashan-app-asar-${Date.now()}`);
  const extractedMain = join(tempDir, "electron", "main.mjs");
  assertInsideRepo(tempDir, "temp asar extract dir");
  try {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    asar.extractAll(unpackedAsar, tempDir);
    if (!existsSync(extractedMain)) {
      throw new Error(`Extracted Electron main missing: ${extractedMain}`);
    }
    cpSync(desktopMainSource, extractedMain, { force: true });
    await asar.createPackage(tempDir, unpackedAsar);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  return Date.now() - startedAt;
}

function checkRendererStrings(text) {
  const required = [
    "TashanWork",
    "他山",
    "项目空间",
    "会话",
    "数字员工",
    "数字员工：按插件调用",
    "当前项目空间",
    "当前模型",
    "研究写作员工",
    "企业知识管理",
    "采购管理",
    "挂载 Skills",
    "挂载 MCP",
    "权限策略",
    "描述企业任务、资料或流程",
    "Build",
    "Plan",
    "DeepSeek-V4-Pro",
  ];
  const forbidden = [
    "Default agent",
    "Describe your task...",
    "TaShan employee",
    "Big Pickle",
    "TaShan DeepSeek",
    "数字员工商店",
    "当前数字员工：企业数字员工",
    "资料库管家",
    "技能与资料库",
    "项目、任务和最近会话",
    "功能模块与运行入口",
  ];
  const missing = required.filter((item) => !text.includes(item));
  const presentForbidden = forbidden.filter((item) => text.includes(item));
  return {
    ok: missing.length === 0 && presentForbidden.length === 0,
    required,
    missing,
    forbidden,
    presentForbidden,
  };
}

const summary = {
  ok: false,
  startedAt: new Date().toISOString(),
  repoRoot,
  unpackedExe,
  appDist,
  unpackedAppDist,
  commands: [],
  rendererStringCheck: null,
  error: null,
};

try {
  assertInsideRepo(appDist, "appDist");
  assertInsideRepo(unpackedAppDist, "unpackedAppDist");
  if (!existsSync(unpackedExe)) {
    throw new Error(`Unpacked exe not found: ${unpackedExe}`);
  }

  if (!skipTypecheck) {
    summary.commands.push({
      command: "pnpm --filter @openwork/app typecheck",
      elapsedMs: run("pnpm.cmd", ["--filter", "@openwork/app", "typecheck"]),
    });
  }

  summary.commands.push({
    command: "OPENWORK_ELECTRON_BUILD=1 pnpm --filter @openwork/app build",
    elapsedMs: run("pnpm.cmd", ["--filter", "@openwork/app", "build"], {
      env: { OPENWORK_ELECTRON_BUILD: "1" },
    }),
  });

  if (!existsSync(join(appDist, "index.html"))) {
    throw new Error(`Renderer build output missing index.html: ${appDist}`);
  }

  rmSync(unpackedAppDist, { recursive: true, force: true });
  mkdirSync(unpackedAppDist, { recursive: true });
  cpSync(appDist, unpackedAppDist, { recursive: true });

  summary.commands.push({
    command: "refresh unpacked Electron main in app.asar",
    elapsedMs: await refreshUnpackedElectronMain(),
  });

  summary.rendererStringCheck = checkRendererStrings(readRendererText());
  if (!summary.rendererStringCheck.ok) {
    throw new Error(`Renderer string check failed: ${JSON.stringify(summary.rendererStringCheck)}`);
  }

  summary.ok = true;
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, serialized, "utf8");
  }
  process.stdout.write(serialized);
}
