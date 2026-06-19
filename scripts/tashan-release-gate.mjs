import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ignoredSegments = [
  `${sep}node_modules${sep}`,
  `${sep}.git${sep}`,
  `${sep}dist${sep}`,
  `${sep}dist-electron${sep}`,
  `${sep}outputs${sep}loop${sep}evidence${sep}`,
  `${sep}work${sep}upstream${sep}`,
];

const scannedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".html",
  ".css",
]);

const productLayerRoots = [
  "apps/app/src/app/tashan-workbench.ts",
  "apps/app/index.html",
  "apps/desktop/electron-builder.yml",
  "apps/desktop/package.json",
  "scripts/tashan-electron-scnet-demo.mjs",
  "scripts/tashan-refresh-unpacked-renderer.mjs",
  "scripts/tashan-scnet-e2e.mjs",
  "scripts/tashan-seed-skills.mjs",
  "scripts/tashan-release-gate.mjs",
  "skills/tashan-prebuilt",
].map((item) => resolve(repoRoot, item));

const uiBrandFiles = [
  "apps/app/src/app/lib/session-title.ts",
  "apps/app/src/app/utils/index.ts",
  "apps/app/src/components/model-select.tsx",
  "apps/app/src/i18n/index.ts",
  "apps/app/src/react-app/domains/onboarding/welcome-page.tsx",
  "apps/app/src/react-app/domains/session/chat/session-page.tsx",
  "apps/app/src/react-app/domains/session/chat/status-bar.tsx",
  "apps/app/src/react-app/domains/session/modals/use-model-picker.ts",
  "apps/app/src/react-app/domains/session/sidebar/app-sidebar.tsx",
  "apps/app/src/react-app/domains/session/surface/composer/composer.tsx",
  "apps/app/src/react-app/domains/settings/appearance/theme-section.tsx",
  "apps/app/src/react-app/domains/settings/pages/advanced-view-sections.tsx",
  "apps/app/src/react-app/domains/settings/pages/advanced-view.tsx",
  "apps/app/src/react-app/domains/settings/pages/ai-view.tsx",
  "apps/app/src/react-app/domains/settings/pages/extensions-view.tsx",
  "apps/app/src/react-app/domains/settings/pages/general-view.tsx",
  "apps/app/src/react-app/domains/settings/pages/mcp-view.tsx",
  "apps/app/src/react-app/domains/settings/pages/shell-view.tsx",
  "apps/app/src/react-app/domains/settings/shell/settings-page.tsx",
  "apps/app/src/react-app/shell/session-route.tsx",
  "apps/app/src/react-app/shell/settings-route.tsx",
  "apps/app/src/react-app/shell/shell-config.tsx",
  "apps/app/src/react-app/shell/welcome-route.tsx",
].map((item) => resolve(repoRoot, item));

const allowedSecretFiles = new Set([
  "scripts/tashan-release-gate.mjs",
  "scripts/tashan-scnet-e2e.mjs",
  "scripts/tashan-electron-scnet-demo.mjs",
  "apps/server/src/env-routes.e2e.test.ts",
  "apps/server/src/env-file.test.ts",
  "apps/server/src/portable-opencode.test.ts",
  "apps/server/src/workspace-export-safety.test.ts",
  "apps/app/tests/env-context.test.ts",
].map((item) => item.replaceAll("/", sep)));

const errors = [];
const warnings = [];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (ignoredSegments.some((segment) => full.includes(segment))) continue;
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".")) : "";
    if (!scannedExtensions.has(extension)) continue;
    const size = statSync(full).size;
    if (size > 1_500_000) continue;
    files.push(full);
  }
  return files;
}

function rel(file) {
  return relative(repoRoot, file);
}

function isUnder(file, root) {
  const normalizedRoot = `${resolve(root)}${sep}`;
  const normalizedFile = resolve(file);
  return normalizedFile === resolve(root) || normalizedFile.startsWith(normalizedRoot);
}

function addProblem(kind, file, line, text) {
  errors.push({ kind, file: rel(file), line, text: text.trim().slice(0, 220) });
}

function addWarning(kind, file, line, text) {
  warnings.push({ kind, file: rel(file), line, text: text.trim().slice(0, 220) });
}

function isCommentOrBrandShim(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*/") ||
    trimmed.includes(".replace(/OpenWork") ||
    trimmed.includes(".replace(/OpenCode") ||
    trimmed.includes("DEFAULT_SESSION_TITLE = \"New session\"") ||
    trimmed.includes(".openwork.dev") ||
    trimmed.includes("\\.openwork\\.dev") ||
    trimmed.includes("openwork\\\\.dev") ||
    trimmed.includes("OpenWork Computer Use.app") ||
    trimmed.includes("__OPENWORK") ||
    trimmed.includes("X-OpenWork-Host-Token")
  );
}

const files = walk(repoRoot);

for (const file of files) {
  const relativePath = rel(file);
  const normalized = relativePath.replaceAll("/", sep);
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/\bsk-[A-Za-z0-9_-]{24,}\b/.test(line) && !allowedSecretFiles.has(normalized)) {
      addProblem("possible-secret", file, index + 1, line);
    }
  });

  const isProductLayer = productLayerRoots.some((root) => isUnder(file, root));
  const isTouchedUiFile = uiBrandFiles.some((root) => resolve(file) === root);
  const isTashanScript = normalized.startsWith(`scripts${sep}tashan-`);
  if ((isProductLayer || isTouchedUiFile) && !isTashanScript) {
    lines.forEach((line, index) => {
      if (
        /\b(OpenWork|OpenCode|New session|Default agent|TaShan employee|数字员工商店|员工市场)\b/.test(line) &&
        !isCommentOrBrandShim(line)
      ) {
        addProblem("visible-brand-or-old-copy", file, index + 1, line);
      }
    });
  }

  if (
    isProductLayer &&
    /from\s+["'][^"']*ee[\\/]|import\([^)]*["'][^"']*ee[\\/]|@openwork-ee\//.test(text)
  ) {
    addProblem("ee-import-in-product-layer", file, 1, "Product layer must not import /ee or @openwork-ee packages.");
  }

  if (!isProductLayer && !isTouchedUiFile && /OpenWork|OpenCode/.test(text) && normalized.startsWith(`apps${sep}app${sep}src${sep}`)) {
    addWarning("base-layer-brand-reference", file, 1, "Base-layer OpenWork/OpenCode reference remains. CDP visible-text check decides whether this is user-facing.");
  }

  if (
    normalized.startsWith(`apps${sep}app${sep}src${sep}`) &&
    normalized !== `apps${sep}app${sep}src${sep}react-app${sep}domains${sep}session${sep}sync${sep}prompt-file-parts.ts`
  ) {
    lines.forEach((line, index) => {
      if (/file:\/\/\$\{/.test(line)) {
        addProblem(
          "direct-file-url-template",
          file,
          index + 1,
          "Use localFilePathToFileUrl() for model file parts; direct file://${...} templates break Windows paths.",
        );
      }
    });
  }
}

const promptFilePartsTest = resolve(repoRoot, "apps/app/tests/prompt-file-parts.test.ts");
if (existsSync(promptFilePartsTest)) {
  const promptFilePartsTestText = readFileSync(promptFilePartsTest, "utf8");
  for (const required of ["file://C:/Users/omar/list.csv", "/C:/Users/omar/list.csv", "localFilePathToFileUrl"]) {
    if (!promptFilePartsTestText.includes(required)) {
      errors.push({
        kind: "missing-windows-file-url-test",
        file: rel(promptFilePartsTest),
        line: 1,
        text: `prompt-file-parts tests must cover ${required}.`,
      });
    }
  }
} else {
  errors.push({
    kind: "missing-windows-file-url-test",
    file: rel(promptFilePartsTest),
    line: 1,
    text: "prompt-file-parts test file is missing.",
  });
}

const desktopIcon = resolve(repoRoot, "apps/desktop/resources/icons/icon.ico");
if (!existsSync(desktopIcon)) {
  errors.push({ kind: "missing-icon", file: rel(desktopIcon), line: 1, text: "Windows icon.ico is missing." });
}

const desktopPng = resolve(repoRoot, "apps/desktop/resources/icons/icon.png");
if (!existsSync(desktopPng)) {
  errors.push({ kind: "missing-icon", file: rel(desktopPng), line: 1, text: "Desktop icon.png is missing." });
}

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "apps/desktop/package.json"), "utf8"));
if (packageJson.description !== "TashanWork desktop shell") {
  warnings.push({
    kind: "desktop-description",
    file: "apps/desktop/package.json",
    text: "Desktop package description is not the expected TashanWork description.",
  });
}

const result = {
  ok: errors.length === 0,
  scannedFiles: files.length,
  errors,
  warningCount: warnings.length,
  warnings: warnings.slice(0, 25),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exit(1);
