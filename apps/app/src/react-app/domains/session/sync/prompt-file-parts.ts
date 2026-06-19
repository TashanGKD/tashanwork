import type { FilePartInput } from "@opencode-ai/sdk/v2/client";

const FIRST_LINE_LOCAL_PATH_RE = /(?:file:\/\/[^\s"'`<>]+|~\/[^\s"'`<>]+|[A-Za-z]:[\\/][^\s"'`<>]+|(?<![:/])\/[A-Za-z0-9._~+%/-]*[\/.][A-Za-z0-9._~+%/-]*)/g;
const TRAILING_PUNCTUATION_RE = /[),.;:]+$/;
const TASHAN_DIGITAL_EMPLOYEE_COMMAND_RE = /^\/tashan-digital-employees(?:\/|\s|$)/;

function stripTrailingPunctuation(value: string) {
  return value.replace(TRAILING_PUNCTUATION_RE, "");
}

function hasPathBoundary(line: string, start: number) {
  if (start <= 0) return true;
  return /[\s("'[]/.test(line[start - 1] ?? "");
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeFileUri(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "file:") return "";
    const pathname = safeDecodeURIComponent(parsed.pathname);
    if (!pathname) return "";
    if (/^\/[A-Za-z]:\//.test(pathname)) return pathname.slice(1);
    if (parsed.hostname && parsed.hostname.toLowerCase() !== "localhost") {
      // `file://C:/path` is not a valid absolute file URL on Windows. It is
      // parsed as host `c`, then crashes Node's fileURLToPath downstream.
      if (/^[A-Za-z]$/i.test(parsed.hostname)) return "";
      return `//${parsed.hostname}${pathname}`;
    }
    return pathname;
  } catch {
    return "";
  }
}

function homeFromWorkspaceRoot(workspaceRoot: string) {
  const normalized = workspaceRoot.trim().replace(/\\/g, "/");
  const macMatch = normalized.match(/^(\/Users\/[^/]+)(?:\/|$)/);
  if (macMatch) return macMatch[1] ?? "";
  const linuxMatch = normalized.match(/^(\/home\/[^/]+)(?:\/|$)/);
  if (linuxMatch) return linuxMatch[1] ?? "";
  return "";
}

function toAbsolutePath(value: string, workspaceRoot: string) {
  if (/^file:\/\//i.test(value)) return normalizeFileUri(value);
  if (value.startsWith("~/")) {
    const home = homeFromWorkspaceRoot(workspaceRoot);
    return home ? `${home}/${value.slice(2)}` : "";
  }
  if (value.startsWith("/")) return value;
  if (/^[A-Za-z]:[\\/]/.test(value)) return value.replace(/\\/g, "/");
  return "";
}

function filenameFromPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "file";
}

function encodeFilePath(path: string) {
  return path.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/");
}

export function localFilePathToFileUrl(path: string) {
  const raw = path.trim().replace(/\\/g, "/");
  const normalized = /^\/[A-Za-z]:\//.test(raw) ? raw.slice(1) : raw;
  if (!normalized) return "";
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${encodeFilePath(normalized).replace(/^([A-Za-z])%3A/, "$1:")}`;
  if (normalized.startsWith("//")) return `file://${encodeFilePath(normalized.replace(/^\/+/, ""))}`;
  if (!normalized.startsWith("/")) return "";
  return `file://${encodeFilePath(normalized)}`;
}

export function firstLineLocalFileParts(text: string, workspaceRoot: string): FilePartInput[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  if (TASHAN_DIGITAL_EMPLOYEE_COMMAND_RE.test(firstLine.trim())) return [];
  const parts: FilePartInput[] = [];
  const seen = new Set<string>();

  for (const match of firstLine.matchAll(FIRST_LINE_LOCAL_PATH_RE)) {
    if (!hasPathBoundary(firstLine, match.index ?? 0)) continue;
    const raw = stripTrailingPunctuation(match[0]);
    const absolute = toAbsolutePath(raw, workspaceRoot);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);
    parts.push({
      type: "file",
      mime: "text/plain",
      url: localFilePathToFileUrl(absolute),
      filename: filenameFromPath(raw),
    });
  }

  return parts;
}
