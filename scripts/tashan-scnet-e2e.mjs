import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createOpencodeClient } from "../apps/server/node_modules/@opencode-ai/sdk/dist/v2/client.js";

import { startEmbeddedServer } from "../apps/server/src/index.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(repoRoot, ".env.runtime.local");
const runtimeRoot = resolve(repoRoot, "..", "loop-runtime", `scnet-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`);
const workspaceRoot = join(runtimeRoot, "workspace");
const configPath = join(runtimeRoot, "server.json");
const opencodeConfigDir = join(runtimeRoot, "opencode-config");
const runtimeDbPath = join(runtimeRoot, "runtime.sqlite");
const progress = [];
const keepAlive = process.argv.includes("--keep-alive");
const outputPathArgIndex = process.argv.indexOf("--output");
const outputPath =
  outputPathArgIndex >= 0 && process.argv[outputPathArgIndex + 1]
    ? resolve(process.argv[outputPathArgIndex + 1])
    : process.env.TASHAN_E2E_OUTPUT
      ? resolve(process.env.TASHAN_E2E_OUTPUT)
      : "";

function mark(step, extra = {}) {
  progress.push({ step, at: new Date().toISOString(), ...extra });
}

function parseEnvFile(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function mask(value) {
  if (!value) return "";
  return "<redacted>";
}

async function freePort(host = "127.0.0.1") {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolvePort(address.port);
        else reject(new Error("Failed to allocate free port"));
      });
    });
  });
}

function unwrap(result, label) {
  if (result?.data !== undefined && result.data !== null) return result.data;
  const status = result?.response?.status;
  const error = result?.error;
  throw new Error(`${label} failed${status ? ` (${status})` : ""}: ${JSON.stringify(error)}`);
}

function collectText(value, max = 1200) {
  const text = [];
  const visit = (node) => {
    if (text.join("\n").length > max) return;
    if (typeof node === "string") {
      text.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") text.push(node.text);
    if (typeof node.content === "string") text.push(node.content);
    if (Array.isArray(node.parts)) node.parts.forEach(visit);
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(value);
  return text.join("\n").replace(/\s+/g, " ").trim().slice(0, max);
}

function summarizeMessages(value) {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.messages)
        ? value.messages
        : [];
  return list.slice(0, 12).map((message) => {
    const record = message && typeof message === "object" ? message : {};
    const info = record.info && typeof record.info === "object" ? record.info : {};
    const parts = Array.isArray(record.parts) ? record.parts : [];
    return {
      id: record.id ?? info.id ?? null,
      role: record.role ?? info.role ?? null,
      keys: Object.keys(record).slice(0, 12),
      infoKeys: Object.keys(info).slice(0, 12),
      error: info.error ? JSON.stringify(info.error).slice(0, 500) : null,
      parts: parts.slice(0, 12).map((part) => {
        const partRecord = part && typeof part === "object" ? part : {};
        return {
          type: partRecord.type ?? null,
          keys: Object.keys(partRecord).slice(0, 12),
          text: typeof partRecord.text === "string" ? partRecord.text.slice(0, 500) : null,
          error: partRecord.error ? JSON.stringify(partRecord.error).slice(0, 500) : null,
        };
      }),
    };
  });
}

function collectAssistantVisibleText(value, max = 1200) {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.messages)
        ? value.messages
        : [];
  const chunks = [];
  for (const message of list) {
    const record = message && typeof message === "object" ? message : {};
    const info = record.info && typeof record.info === "object" ? record.info : {};
    const role = record.role ?? info.role ?? null;
    if (role !== "assistant") continue;
    const parts = Array.isArray(record.parts) ? record.parts : [];
    for (const part of parts) {
      const partRecord = part && typeof part === "object" ? part : {};
      if (partRecord.type !== "text") continue;
      if (typeof partRecord.text === "string") chunks.push(partRecord.text);
    }
  }
  return chunks.join("\n").replace(/\s+/g, " ").trim().slice(0, max);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${raw}`);
  }
  return body;
}

async function waitForAssistant(client, sessionId, timeoutMs = 180000) {
  const started = Date.now();
  let lastPreview = "";
  let lastStatus = null;
  let lastMessages = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const status = unwrap(await client.session.status(), "session.status");
      lastStatus = status;
    } catch {
      lastStatus = null;
    }
    const messages = unwrap(
      await client.session.messages({ sessionID: sessionId, limit: 20 }),
      "session.messages",
    );
    const preview = collectAssistantVisibleText(messages);
    lastMessages = messages;
    if (preview) lastPreview = preview;
    if (/他山模型接入通过|模型接入通过|接入通过/.test(preview)) {
      return { ok: true, preview, messages, summary: summarizeMessages(messages) };
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 2500));
  }
  return {
    ok: false,
    preview: lastPreview,
    status: lastStatus,
    summary: summarizeMessages(lastMessages),
  };
}

async function stopWithTimeout(handle, timeoutMs = 5000) {
  try {
    await Promise.race([
      handle.stop(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out stopping embedded server after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeOutput(payload) {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
}

async function waitUntilShutdown(handle) {
  let shuttingDown = false;
  await new Promise((resolveShutdown) => {
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void stopWithTimeout(handle)
        .then((stopped) => {
          mark("stop.done", stopped);
        })
        .finally(resolveShutdown);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function main() {
  const env = parseEnvFile(await readFile(envPath, "utf8"));
  const baseURL = env.TASHAN_LLM_BASE_URL?.trim();
  const apiKey = env.TASHAN_LLM_API_KEY?.trim();
  const modelID = env.TASHAN_LLM_MODEL?.trim() || "DeepSeek-V4-Pro";
  if (!baseURL || !apiKey) {
    throw new Error("Missing TASHAN_LLM_BASE_URL or TASHAN_LLM_API_KEY in .env.runtime.local");
  }

  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(opencodeConfigDir, { recursive: true });
  await writeFile(
    join(workspaceRoot, "README.md"),
    "# 他山企业 AI 工作台 Demo Workspace\n\nThis workspace is generated for runtime verification.\n",
    "utf8",
  );

  process.env.OPENCODE_CONFIG_DIR = opencodeConfigDir;
  process.env.OPENWORK_RUNTIME_DB = runtimeDbPath;
  process.env.SCNET_API_KEY = apiKey;

  const port = await freePort();
  const token = "tashan-client-token";
  const hostToken = "tashan-host-token";
  mark("startEmbeddedServer.begin", { port });
  const handle = await startEmbeddedServer({
    configPath,
    host: "127.0.0.1",
    port,
    token,
    hostToken,
    approvalMode: "auto",
    logRequests: false,
    logFormat: "json",
    workspaces: [workspaceRoot],
    manageOpencode: true,
    opencodeBin: process.env.OPENWORK_OPENCODE_BIN || "opencode.cmd",
    opencodeCwd: workspaceRoot,
  });
  mark("startEmbeddedServer.ok", { serverUrl: handle.url });

  let exitCode = 0;
  let keepAliveShutdownHandled = false;
  try {
    mark("workspaces.begin");
    const workspaceList = await fetchJson(`${handle.url}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const workspace = workspaceList.items?.[0];
    if (!workspace?.id) throw new Error("OpenWork server returned no workspace");
    mark("workspaces.ok", { workspaceId: workspace.id });

    mark("patchConfig.begin");
    await fetchJson(`${handle.url}/workspace/${encodeURIComponent(workspace.id)}/config`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        opencode: {
          provider: {
            scnet: {
              npm: "@ai-sdk/openai-compatible",
              name: "SCNet",
              env: ["SCNET_API_KEY"],
              options: { baseURL },
              models: {
                [modelID]: {
                  name: modelID,
                  attachment: false,
                  reasoning: false,
                  tool_call: false,
                  temperature: true,
                },
              },
            },
          },
        },
      }),
    });
    mark("patchConfig.ok");

    const proxyBase = `${handle.url}/workspace/${encodeURIComponent(workspace.id)}/opencode`;
    const opencode = createOpencodeClient({
      baseUrl: proxyBase,
      headers: { Authorization: `Bearer ${token}` },
    });

    let authSet = false;
    try {
      mark("authSet.begin");
      unwrap(
        await opencode.auth.set({
          providerID: "scnet",
          auth: { type: "api", key: apiKey },
        }),
        "auth.set",
      );
      authSet = true;
      mark("authSet.ok");
    } catch {
      authSet = false;
      mark("authSet.skippedOrFailed");
    }

    mark("engineReload.begin");
    await fetchJson(`${handle.url}/workspace/${encodeURIComponent(workspace.id)}/engine/reload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    mark("engineReload.ok");

    mark("providerList.begin");
    const providers = unwrap(await opencode.provider.list(), "provider.list");
    const providerText = JSON.stringify(providers);
    const providerVisible = providerText.includes("scnet") || providerText.includes(modelID);
    mark("providerList.ok", { providerVisible });

    mark("sessionCreate.begin");
    const created = unwrap(
      await opencode.session.create({
        title: "企业资料整理与研究写作",
        directory: workspaceRoot,
      }),
      "session.create",
    );
    const sessionId = created.id;
    mark("sessionCreate.ok", { sessionId });

    const eventTypes = [];
    const eventController = new AbortController();
    const eventReader = (async () => {
      try {
        const subscription = await opencode.event.subscribe(undefined, {
          signal: eventController.signal,
        });
        for await (const raw of subscription.stream) {
          const type = raw?.type ?? raw?.data?.type ?? raw?.event ?? "unknown";
          eventTypes.push(String(type));
          if (eventTypes.length >= 40) break;
        }
      } catch {
        // Event capture is diagnostic only.
      }
    })();

    mark("promptAsync.begin");
    unwrap(
      await opencode.session.promptAsync({
        sessionID: sessionId,
        model: { providerID: "scnet", modelID },
        tools: { bash: false, edit: false, write: false, read: false },
        system: "你正在进行企业工作台模型连通性验收。不要调用任何工具，不要读写文件，只用中文回答固定短句。",
        parts: [{ type: "text", text: "请只回复：他山模型接入通过。" }],
      }),
      "session.promptAsync",
    );
    mark("promptAsync.ok");

    const assistant = await waitForAssistant(opencode, sessionId);
    eventController.abort();
    await Promise.race([
      eventReader,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    mark("assistantWait.done", { assistantOk: assistant.ok, eventCount: eventTypes.length });
    const audit = await fetchJson(`${handle.url}/workspace/${encodeURIComponent(workspace.id)}/audit?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const output = {
      ok: providerVisible && assistant.ok,
      providerVisible,
      assistantOk: assistant.ok,
      model: { providerID: "scnet", modelID, baseURL, apiKey: mask(apiKey) },
      authSet,
      workspaceId: workspace.id,
      sessionId,
      serverUrl: handle.url,
      managedOpencode: handle.managedOpencodeExecution,
      assistantPreview: assistant.preview,
      messageSummary: assistant.summary,
      sessionStatus: assistant.status,
      eventTypes: [...new Set(eventTypes)].slice(0, 20),
      auditActions: (audit.items ?? []).map((item) => item.action).slice(0, 10),
      progress,
      runtimeRoot,
    };
    console.log(JSON.stringify(output, null, 2));
    await writeOutput(output);
    if (!output.ok) exitCode = 2;
    if (keepAlive && output.ok) {
      mark("keepAlive.begin", { outputPath: outputPath ? "<written>" : "<none>" });
      await writeOutput({ ...output, progress });
      await waitUntilShutdown(handle);
      keepAliveShutdownHandled = true;
      return;
    }
  } finally {
    if (keepAliveShutdownHandled) {
      process.exitCode = exitCode;
      process.exit(exitCode);
    }
    const stopped = await stopWithTimeout(handle);
    mark("stop.done", stopped);
    if (!stopped.ok && exitCode === 0) exitCode = 3;
    process.exitCode = exitCode;
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
