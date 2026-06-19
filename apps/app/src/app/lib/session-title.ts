import { t } from "../../i18n";

/** Raw English string — used for prefix matching against stored titles. */
export const DEFAULT_SESSION_TITLE = "New session";

const GENERATED_SESSION_TITLE_PREFIX = `${DEFAULT_SESSION_TITLE} - `;
const LEGACY_DEMO_SESSION_TITLES = new Set([
  "他山 Electron SCNet 验收",
  "他山 SCNet 模型接入验收",
  "他山 EXE 交付助手",
  "他山exe交付助手",
]);

export function isGeneratedSessionTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? "";
  if (trimmed === DEFAULT_SESSION_TITLE) return true;
  if (!trimmed.startsWith(GENERATED_SESSION_TITLE_PREFIX)) return false;
  const suffix = trimmed.slice(GENERATED_SESSION_TITLE_PREFIX.length).trim();
  return Boolean(suffix) && Number.isFinite(Date.parse(suffix));
}

export function getDisplaySessionTitle(
  title: string | null | undefined,
  fallback?: string,
) {
  const trimmed = title?.trim() ?? "";
  if (!trimmed || isGeneratedSessionTitle(trimmed)) return fallback ?? t("session.default_title");
  if (LEGACY_DEMO_SESSION_TITLES.has(trimmed)) return "企业资料整理与研究写作";
  return trimmed;
}
