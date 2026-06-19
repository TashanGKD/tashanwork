import type { FilePartInput } from "@opencode-ai/sdk/v2/client";

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

export function firstLineLocalFileParts(_text: string, _workspaceRoot: string): FilePartInput[] {
  // Do not silently convert typed local paths into OpenCode file parts. In the
  // packaged desktop runtime those parts are pre-read before the model call;
  // failures poison the session with low-signal Read errors. Explicit uploads
  // and command-created attachments still use localFilePathToFileUrl().
  return [];
}
