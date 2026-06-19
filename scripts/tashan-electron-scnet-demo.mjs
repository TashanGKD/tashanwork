import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path, { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outerRoot = resolve(repoRoot, "..", "..");
const envPath = join(repoRoot, ".env.runtime.local");
const defaultExePath = join(
  repoRoot,
  "apps",
  "desktop",
  "dist-electron",
  "win-unpacked",
  existsSync(join(repoRoot, "apps", "desktop", "dist-electron", "win-unpacked", "TashanWork.exe"))
    ? "TashanWork.exe"
    : "TaShan Enterprise AI Workbench.exe",
);
const outputArgIndex = process.argv.indexOf("--output");
const keepAlive = process.argv.includes("--keep-alive");
const checkKnowledgeStarter = process.argv.includes("--check-knowledge-starter");
const checkPluginDigitalEmployee = process.argv.includes("--check-plugin-digital-employee");
const complexReadmeScreenshot = process.argv.includes("--complex-readme-screenshot");
const complexReadmeSubmit = process.argv.includes("--complex-readme-submit");
const outputDir = outputArgIndex >= 0 && process.argv[outputArgIndex + 1]
  ? resolve(process.argv[outputArgIndex + 1])
  : join(outerRoot, "outputs", "loop", "evidence", timestampSlug());
const knowledgePromptMarker = "作为他山企业资料库数字员工";
const complexTaskPrompt = [
  "@企业知识管理 请基于当前项目空间里的资料，完成一份“企业 AI 工作台落地方案”的初版交付。",
  "",
  "要求：",
  "1. 先列出你会读取和整理哪些资料，并把任务拆成 5-7 个可检查步骤。",
  "2. 汇总项目目标、现有能力、缺口、主要风险和明天可演示路径。",
  "3. 输出一份面向管理层的中文方案，包含：背景、目标用户、核心场景、数字员工配置、资料库使用方式、权限确认流程、模型接入方式、部署风险和下一步计划。",
  "4. 遇到需要读取文件、调用工具或执行可能影响工作区的操作时，先说明原因并等待确认。",
  "5. 最后给出一个 100 分制的完成度评分，并列出最大扣分项。",
].join("\n");

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function parseEnvFile(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function maskSecret(value) {
  return value ? "<redacted>" : "";
}

function sanitizeForEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|password|username|auth|secret|key|credential/i.test(key)) {
      out[key] = typeof entry === "string" ? "<redacted>" : sanitizeForEvidence(entry);
    } else {
      out[key] = sanitizeForEvidence(entry);
    }
  }
  return out;
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
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${raw.slice(0, 800)}`);
  }
  return body;
}

function unwrapOpencode(result, label, allowNoBody = false) {
  if (result?.data !== undefined && result.data !== null) return result.data;
  if (allowNoBody && result?.response?.status === 204) return null;
  throw new Error(`${label} failed (${result?.response?.status ?? "no-status"}): ${JSON.stringify(result?.error)}`);
}

function assistantText(value) {
  return assistantTexts(value).join("\n").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function assistantTexts(value) {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.messages)
        ? value.messages
        : [];
  const chunks = [];
  for (const message of list) {
    const role = message?.role ?? message?.info?.role;
    if (role !== "assistant") continue;
    for (const part of Array.isArray(message?.parts) ? message.parts : []) {
      if (part?.type === "text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function waitForAssistant(opencode, sessionId, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let preview = "";
  let status = null;
  while (Date.now() < deadline) {
    status = await opencode.session.status().then((result) => result.data ?? null).catch(() => null);
    const messages = unwrapOpencode(
      await opencode.session.messages({ sessionID: sessionId, limit: 20 }),
      "session.messages",
    );
    preview = assistantText(messages) || preview;
    if (/他山模型接入通过|模型接入通过|接入通过/.test(preview)) {
      return { ok: true, preview, status };
    }
    await sleep(2500);
  }
  return { ok: false, preview, status };
}

async function listAssistantTexts(opencode, sessionId) {
  const messages = unwrapOpencode(
    await opencode.session.messages({ sessionID: sessionId, limit: 50 }),
    "session.messages",
  );
  return assistantTexts(messages);
}

async function waitForNewAssistant(opencode, sessionId, previousTexts, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  const previous = new Set(previousTexts);
  let preview = "";
  let status = null;
  let lastPreview = "";
  let lastChangedAt = Date.now();
  while (Date.now() < deadline) {
    status = await opencode.session.status().then((result) => result.data ?? null).catch(() => null);
    const texts = await listAssistantTexts(opencode, sessionId).catch(() => []);
    const next = texts.filter((text) =>
      !previous.has(text) &&
      text.length >= 20 &&
      !/^他山模型接入通过。?$/.test(text)
    ).at(-1);
    preview = next || texts.at(-1) || preview;
    if (preview && preview !== lastPreview) {
      lastPreview = preview;
      lastChangedAt = Date.now();
    }
    const isBusy = status?.[sessionId]?.type === "busy";
    if (next && !isBusy && Date.now() - lastChangedAt >= 3000) {
      return { ok: true, preview: next.slice(0, 1200), status, completed: true };
    }
    if (next && Date.now() - lastChangedAt >= 30_000) {
      return { ok: true, preview: next.slice(0, 1200), status, completed: !isBusy, stableButBusy: isBusy };
    }
    await sleep(3000);
  }
  return { ok: false, preview: preview.slice(0, 1200), status, completed: false };
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function waitForCdpTarget(cdpBaseUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "no target";
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`${cdpBaseUrl}/json/list`);
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl)
        ?? targets.find((target) => target.webSocketDebuggerUrl);
      if (page) return page;
      last = "no page target";
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`CDP target timeout: ${last}`);
}

function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const notifications = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolveCall, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolveCall(message.result);
      return;
    }
    if (message.method) notifications.push(message);
  };
  return new Promise((resolveConnect, rejectConnect) => {
    const timer = setTimeout(() => rejectConnect(new Error("WebSocket connect timeout")), 10_000);
    ws.onerror = () => {
      clearTimeout(timer);
      rejectConnect(new Error("WebSocket error"));
    };
    ws.onopen = () => {
      clearTimeout(timer);
      resolveConnect({
        notifications,
        send(method, params = {}) {
          const callId = ++id;
          ws.send(JSON.stringify({ id: callId, method, params }));
          return new Promise((resolveCall, reject) => pending.set(callId, { resolve: resolveCall, reject }));
        },
        close() {
          ws.close();
        },
      });
    };
  });
}

async function evaluate(client, expression, timeout = 60_000) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function waitForElectronBridge(client) {
  return evaluate(client, `
    new Promise((resolve) => {
      if (window.__OPENWORK_ELECTRON__) return resolve(true);
      const timer = setInterval(() => {
        if (window.__OPENWORK_ELECTRON__) {
          clearInterval(timer);
          resolve(true);
        }
      }, 250);
      setTimeout(() => {
        clearInterval(timer);
        resolve(false);
      }, 20000);
    })
  `);
}

async function captureScreenshot(client, filePath) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  if (!result?.data) return false;
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  return true;
}

async function waitForCondition(client, expression, timeoutMs = 30_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression, 10_000);
    if (last?.ok) return last;
    await sleep(intervalMs);
  }
  return last ?? { ok: false, error: "condition timed out" };
}

async function checkKnowledgeStarterPath(client, outputDir) {
  const before = await evaluate(client, `
    (() => ({
      hash: window.location.hash,
      route: window.__openwork?.slice?.("route") ?? null,
      composer: window.__openwork?.slice?.("composer") ?? null
    }))()
  `);

  const clickResult = await evaluate(client, `
    (async () => {
      const allButtons = () => Array.from(document.querySelectorAll("button"))
        .map((button) => ({
          button,
          text: (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim()
        }));
      const moduleButton = allButtons().find((entry) => entry.text === "资料库" || /资料库/.test(entry.text));
      if (moduleButton) {
        moduleButton.button.click();
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      const candidates = allButtons()
        .filter((entry) => entry.text.includes("知识索引") || entry.text.includes("生成知识索引"));
      const target = candidates[0];
      if (!target) {
        return {
          ok: false,
          reason: "knowledge starter button not found",
          buttonTexts: allButtons()
            .map((entry) => entry.text)
            .filter(Boolean)
            .slice(0, 80)
        };
      }
      target.button.click();
      return { ok: true, moduleText: moduleButton?.text ?? null, text: target.text };
    })()
  `);
  if (!clickResult?.ok) {
    return {
      ok: false,
      before,
      click: clickResult,
      after: null,
      reason: clickResult?.reason ?? "click failed",
    };
  }

  const after = await waitForCondition(client, `
    (() => {
      const composer = window.__openwork?.slice?.("composer") ?? null;
      const route = window.__openwork?.slice?.("route") ?? null;
      const draft = String(composer?.draft || "");
      const bodyText = String(document.body?.innerText || "");
      return {
        ok: draft.includes(${JSON.stringify(knowledgePromptMarker)}),
        hash: window.location.hash,
        routeSessionId: route?.selectedSessionId ?? route?.sessionId ?? null,
        composerSessionId: composer?.sessionId ?? null,
        draftLength: draft.length,
        draftHasKnowledgeMarker: draft.includes(${JSON.stringify(knowledgePromptMarker)}),
        bodyHasKnowledgeIndexLabel: bodyText.includes("资料库索引") || bodyText.includes("资料库"),
        bodyHasStartTask: bodyText.includes("Start task") || bodyText.includes("运行任务"),
      };
    })()
  `, 45_000, 750);

  const screenshotPath = join(outputDir, "tashan-knowledge-starter-click.png");
  const screenshotCaptured = await captureScreenshot(client, screenshotPath);
  return {
    ok: Boolean(after?.ok),
    before: sanitizeForEvidence(before),
    click: sanitizeForEvidence(clickResult),
    after: sanitizeForEvidence(after),
    screenshot: screenshotCaptured ? screenshotPath : null,
  };
}

async function checkPluginDigitalEmployeePath(client, outputDir) {
  const result = await evaluate(client, `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const buttonText = (button) => (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim();
      const buttons = () => Array.from(document.querySelectorAll("button"));
      const toolButton = buttons()
        .filter((button) => {
          const title = button.getAttribute("title") || "";
          const label = button.getAttribute("aria-label") || "";
          return title.includes("命令") || title.includes("MCP") || label.includes("命令") || label.includes("MCP");
        })
        .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
      if (!toolButton) {
        return {
          ok: false,
          step: "find-composer-plugin-button",
          buttonTexts: buttons().map(buttonText).filter(Boolean).slice(0, 120)
        };
      }
      toolButton.click();
      await sleep(1200);

      const hasDigitalEmployeeGroup = (document.body.innerText || "").includes("数字员工");
      const employeeButton = buttons().find((button) => buttonText(button) === "企业知识管理")
        || buttons().find((button) => buttonText(button).includes("企业知识管理"));
      if (!employeeButton) {
        return {
          ok: false,
          step: "find-imported-plugin-section",
          hasDigitalEmployeeGroup,
          bodyPreview: (document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 1400),
          buttonTexts: buttons().map(buttonText).filter(Boolean).slice(0, 120)
        };
      }
      employeeButton.click();
      await sleep(500);

      const employeeLeft = employeeButton.getBoundingClientRect().left;
      const fileButton = buttons()
        .filter((button) => button !== employeeButton)
        .filter((button) => buttonText(button).includes("企业知识管理"))
        .filter((button) => button.getBoundingClientRect().left > employeeLeft + 50)[0]
        || buttons().find((button) => buttonText(button).includes("企业知识管理") && buttonText(button).includes("Command"));
      if (!fileButton) {
        return {
          ok: false,
          step: "find-plugin-command-file",
          hasDigitalEmployeeGroup,
          bodyPreview: (document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 1400),
          buttonTexts: buttons().map(buttonText).filter(Boolean).slice(0, 120)
        };
      }
      fileButton.click();
      await sleep(800);

      const composer = window.__openwork?.slice?.("composer") ?? null;
      const draft = String(composer?.draft || "");
      return {
        ok: draft.includes("/tashan-digital-employees/knowledge-navigator"),
        hasDigitalEmployeeGroup,
        draft,
        bodyPreview: (document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 1200)
      };
    })()
  `, 30_000);

  const screenshotPath = join(outputDir, "tashan-plugin-digital-employee-selection.png");
  const screenshotCaptured = await captureScreenshot(client, screenshotPath);
  return {
    ...sanitizeForEvidence(result),
    screenshot: screenshotCaptured ? screenshotPath : null,
  };
}

async function prepareComplexReadmeScreenshot(client, outputDir, options = {}) {
  const submitTask = Boolean(options.submitTask);
  const openResult = await evaluate(client, `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const buttonText = (button) => (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim();
      const buttons = () => Array.from(document.querySelectorAll("button"));

      const digitalRail = buttons()
        .filter((button) =>
          button.getAttribute("aria-label") === "数字员工" ||
          button.getAttribute("title") === "数字员工"
        )
        .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
      if (!digitalRail) {
        return {
          ok: false,
          step: "open-digital-employee-rail",
          buttonTexts: buttons().map(buttonText).filter(Boolean).slice(0, 80)
        };
      }
      digitalRail.click();
      await sleep(900);

      const textAfterOpen = document.body.innerText || "";
      const hasEmployeeList = textAfterOpen.includes("企业知识管理") && textAfterOpen.includes("数字员工");
      const cards = Array.from(document.querySelectorAll("article"));
      const knowledgeCard = cards.find((card) => (card.innerText || "").includes("企业知识管理"))
        || cards.find((card) => (card.innerText || "").includes("研究写作员工"))
        || null;
      if (!knowledgeCard) {
        return {
          ok: false,
          step: "find-employee-card",
          hasEmployeeList,
          bodyPreview: textAfterOpen.replace(/\\s+/g, " ").slice(0, 1200)
        };
      }

      const detailButton = Array.from(knowledgeCard.querySelectorAll("button"))
        .find((button) => /详情|配置|上岗/.test(buttonText(button)));
      if (!detailButton) {
        return {
          ok: false,
          step: "find-employee-detail-button",
          cardText: (knowledgeCard.innerText || "").replace(/\\s+/g, " ").slice(0, 800)
        };
      }
      detailButton.click();
      await sleep(700);

      const detailPanel = Array.from(document.querySelectorAll("div, section, article"))
        .find((element) => {
          const text = element.innerText || "";
          return text.includes("挂载 Skills") && text.includes("挂载 MCP") && text.includes("权限策略");
        });
      if (detailPanel) {
        detailPanel.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(500);
      }

      const composer = document.querySelector("[contenteditable='true']");
      if (composer) {
        composer.focus();
        document.execCommand("selectAll", false);
        document.execCommand("insertText", false, ${JSON.stringify(complexTaskPrompt)});
        composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(complexTaskPrompt)} }));
      }
      await sleep(500);

      let startTaskClicked = false;
      if (${JSON.stringify(submitTask)}) {
        const startTaskButton = buttons()
          .filter((button) => /开始任务|Start task/i.test(buttonText(button)))
          .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
          .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
        if (!startTaskButton) {
          return {
            ok: false,
            step: "find-start-task-button",
            hasDigitalEmployeePanel: true,
            hasKnowledgeEmployee: true,
            hasEmployeeDetail: Boolean(detailPanel),
            hasComplexPrompt: Boolean((document.body.innerText || "").includes("企业 AI 工作台落地方案")),
            buttonTexts: buttons().map(buttonText).filter(Boolean).slice(0, 100)
          };
        }
        startTaskButton.click();
        startTaskClicked = true;
        await sleep(1200);
      }

      const bodyText = document.body.innerText || "";
      return {
        ok: bodyText.includes("企业知识管理") &&
          bodyText.includes("挂载 Skills") &&
          bodyText.includes("挂载 MCP") &&
          bodyText.includes("权限策略") &&
          bodyText.includes("数字员工") &&
          bodyText.includes("企业 AI 工作台落地方案"),
        hasDigitalEmployeePanel: bodyText.includes("数字员工"),
        hasKnowledgeEmployee: bodyText.includes("企业知识管理"),
        hasEmployeeDetail: bodyText.includes("挂载 Skills") && bodyText.includes("挂载 MCP") && bodyText.includes("权限策略"),
        hasComplexPrompt: bodyText.includes("企业 AI 工作台落地方案"),
        submitted: ${JSON.stringify(submitTask)},
        startTaskClicked,
        bodyPreview: bodyText.replace(/\\s+/g, " ").slice(0, 1600)
      };
    })()
  `, 30_000);

  const screenshotPath = join(
    outputDir,
    submitTask
      ? "tashanwork-complex-task-submitted-digital-employee.png"
      : "tashanwork-complex-task-digital-employee.png",
  );
  const screenshotCaptured = await captureScreenshot(client, screenshotPath);
  return {
    ...sanitizeForEvidence(openResult),
    screenshot: screenshotCaptured ? screenshotPath : null,
  };
}

async function focusKnowledgeEmployeeDetail(client) {
  const result = await evaluate(client, `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const buttonText = (button) => (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim();
      const cards = Array.from(document.querySelectorAll("article"));
      const knowledgeCard = cards.find((card) => (card.innerText || "").includes("企业知识管理"));
      if (knowledgeCard) {
        const detailButton = Array.from(knowledgeCard.querySelectorAll("button"))
          .find((button) => /详情|配置/.test(buttonText(button)));
        if (detailButton) {
          detailButton.click();
          await sleep(700);
        }
      }
      const detailPanel = Array.from(document.querySelectorAll("div, section, article"))
        .find((element) => {
          const text = element.innerText || "";
          return text.includes("企业知识管理") &&
            text.includes("挂载 Skills") &&
            text.includes("挂载 MCP") &&
            text.includes("权限策略");
        });
      if (detailPanel) {
        detailPanel.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(500);
      }
      const bodyText = document.body.innerText || "";
      return {
        ok: Boolean(detailPanel),
        hasKnowledgeEmployee: bodyText.includes("企业知识管理"),
        hasEmployeeDetail: bodyText.includes("挂载 Skills") && bodyText.includes("挂载 MCP") && bodyText.includes("权限策略"),
        bodyPreview: bodyText.replace(/\\s+/g, " ").slice(0, 1200)
      };
    })()
  `, 20_000);
  return sanitizeForEvidence(result);
}

function launchElectron(input) {
  const env = {
    ...process.env,
    OPENWORK_ELECTRON_USERDATA: input.userDataDir,
    OPENWORK_SERVER_CONFIG: input.serverConfigPath,
    OPENWORK_ELECTRON_REMOTE_DEBUG_PORT: String(input.cdpPort),
    ELECTRON_EXTRA_LAUNCH_ARGS: "--disable-gpu",
    OPENWORK_LOG_REQUESTS: "0",
    TASHAN_LLM_BASE_URL: input.llm.baseURL,
    TASHAN_LLM_API_KEY: input.llm.apiKey,
    TASHAN_LLM_API_TYPE: input.llm.apiType,
    TASHAN_LLM_MODEL: input.llm.modelID,
    SCNET_API_KEY: input.llm.apiKey,
  };
  return spawn(input.exePath, [], {
    cwd: dirname(input.exePath),
    env,
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: false,
  });
}

function stopProcessTree(pid) {
  if (!pid) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const runtimeRoot = join(outerRoot, "work", "loop-runtime", `tashan-electron-demo-${Date.now()}-${randomUUID().slice(0, 8)}`);
  const userDataDir = join(runtimeRoot, "userdata");
  const workspaceRoot = join(runtimeRoot, "workspace");
  const serverConfigPath = join(runtimeRoot, "server.json");
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(userDataDir, { recursive: true });
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(
    join(workspaceRoot, "README.md"),
    "# 他山企业 AI 工作台 Demo Workspace\n\nGenerated by tashan-electron-scnet-demo.mjs.\n",
    "utf8",
  );

  const env = parseEnvFile(await readFile(envPath, "utf8"));
  const llm = {
    baseURL: env.TASHAN_LLM_BASE_URL?.trim(),
    apiKey: env.TASHAN_LLM_API_KEY?.trim(),
    apiType: env.TASHAN_LLM_API_TYPE?.trim() || "openai-completions",
    modelID: env.TASHAN_LLM_MODEL?.trim() || "DeepSeek-V4-Pro",
  };
  if (!llm.baseURL || !llm.apiKey) {
    throw new Error("Missing TASHAN_LLM_BASE_URL or TASHAN_LLM_API_KEY in .env.runtime.local");
  }
  if (!existsSync(defaultExePath)) {
    throw new Error(`Unpacked exe not found: ${defaultExePath}`);
  }

  const cdpPort = Number(process.env.TASHAN_ELECTRON_CDP_PORT || (9300 + Math.floor(Math.random() * 500)));
  const cdpBaseUrl = `http://127.0.0.1:${cdpPort}`;
  const summary = {
    ok: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exePath: defaultExePath,
    runtimeRoot,
    workspaceRoot,
    cdpBaseUrl,
    model: {
      providerID: "scnet",
      modelID: llm.modelID,
      baseURL: llm.baseURL,
      apiKey: maskSecret(llm.apiKey),
    },
    checks: {},
    artifacts: {},
    error: null,
  };

  let child = null;
  let client = null;
  try {
    const { createOpencodeClient } = await import(
      pathToFileURL(join(repoRoot, "apps", "server", "node_modules", "@opencode-ai", "sdk", "dist", "v2", "client.js")).href
    );

    child = launchElectron({
      exePath: defaultExePath,
      userDataDir,
      serverConfigPath,
      cdpPort,
      llm,
    });
    summary.checks.electronLaunched = { pid: child.pid ?? null };

    const stderrChunks = [];
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
      if (stderrChunks.join("").length > 12000) stderrChunks.shift();
    });

    const target = await waitForCdpTarget(cdpBaseUrl);
    summary.checks.cdpTarget = { id: target.id, title: target.title, url: target.url };
    client = await connectCdp(target.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Log.enable").catch(() => undefined);
    await client.send("Page.enable").catch(() => undefined);

    const bridgeReady = await waitForElectronBridge(client);
    if (!bridgeReady) throw new Error("Electron desktop bridge did not become ready");

    // Enterprise demo default: keep the real model path, but hide reasoning
    // panels using OpenWork's existing local preference. Reload so the React
    // LocalProvider reads the preference during initialization.
    const reasoningHidden = await evaluate(client, `
      (() => {
        const key = "openwork.preferences";
        const current = (() => {
          try { return JSON.parse(window.localStorage.getItem(key) || "{}"); }
          catch { return {}; }
        })();
        window.localStorage.setItem(key, JSON.stringify({
          ...current,
          showThinking: false,
          hasCompletedOnboarding: true
        }));
        window.localStorage.setItem("openwork.showThinking", "false");
        return true;
      })()
    `);
    summary.checks.reasoningHiddenPreference = reasoningHidden === true;
    await client.send("Page.reload", { ignoreCache: true }).catch(() => undefined);
    await sleep(2500);
    const bridgeReadyAfterReload = await waitForElectronBridge(client);
    if (!bridgeReadyAfterReload) throw new Error("Electron desktop bridge did not become ready after preference reload");

    const workspaceLiteral = JSON.stringify(workspaceRoot);
    await evaluate(
      client,
      `window.__OPENWORK_ELECTRON__.invokeDesktop('engineStart', ${workspaceLiteral}, { workspacePaths: [${workspaceLiteral}] })`,
      120_000,
    );
    const serverInfo = await evaluate(client, "window.__OPENWORK_ELECTRON__.invokeDesktop('openworkServerInfo')", 30_000);
    summary.checks.openworkServer = sanitizeForEvidence({
      running: Boolean(serverInfo?.running),
      baseUrl: serverInfo?.baseUrl ?? null,
      managedOpencode: Boolean(serverInfo?.managedOpencodeExecution),
      managedCommand: serverInfo?.managedOpencodeExecution?.command ?? null,
    });
    if (!serverInfo?.running || !serverInfo?.baseUrl) throw new Error("Desktop OpenWork server is not running");
    if (!serverInfo?.managedOpencodeExecution) throw new Error("Desktop server did not report managed OpenCode execution");

    const token = serverInfo.ownerToken || serverInfo.clientToken;
    const headers = { Authorization: `Bearer ${token}` };
    const workspaces = await fetchJson(`${serverInfo.baseUrl}/workspaces`, { headers });
    const workspace = workspaces.items?.find((item) =>
      String(item.path || "").toLowerCase() === workspaceRoot.toLowerCase()
    ) ?? workspaces.items?.[0];
    if (!workspace?.id) throw new Error("OpenWork server returned no workspace");
    summary.checks.workspace = sanitizeForEvidence({
      id: workspace.id,
      path: workspace.path,
      hasOpencodeBaseUrl: Boolean(workspace.opencode?.baseUrl || workspace.baseUrl),
    });
    if (!workspace.opencode?.baseUrl && !workspace.baseUrl) {
      throw new Error("Workspace did not expose opencode.baseUrl");
    }

    const workspaceOpenworkPath = join(workspaceRoot, ".opencode", "openwork.json");
    const commandRoot = join(workspaceRoot, ".opencode", "commands", "tashan-digital-employees");
    const workspaceOpenwork = existsSync(workspaceOpenworkPath)
      ? JSON.parse(await readFile(workspaceOpenworkPath, "utf8"))
      : {};
    const digitalEmployeePlugins = Object.keys(workspaceOpenwork?.cloudImports?.plugins ?? {})
      .filter((pluginId) => pluginId.startsWith("tashan-"));
    summary.checks.digitalEmployeePluginConfig = {
      pluginCount: digitalEmployeePlugins.length,
      plugins: digitalEmployeePlugins,
      commandFiles: [
        "research-writer.md",
        "project-manager.md",
        "knowledge-navigator.md",
        "decision-support.md",
      ].filter((name) => existsSync(join(commandRoot, name))),
    };

    await fetchJson(`${serverInfo.baseUrl}/workspace/${encodeURIComponent(workspace.id)}/config`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        opencode: {
          provider: {
            scnet: {
              npm: "@ai-sdk/openai-compatible",
              name: "SCNet",
              env: ["SCNET_API_KEY"],
              options: { baseURL: llm.baseURL },
              models: {
                [llm.modelID]: {
                  name: llm.modelID,
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

    const opencode = createOpencodeClient({
      baseUrl: `${serverInfo.baseUrl}/workspace/${encodeURIComponent(workspace.id)}/opencode`,
      headers,
    });
    await opencode.auth.set({ providerID: "scnet", auth: { type: "api", key: llm.apiKey } }).catch(() => undefined);
    const reload = await fetchJson(`${serverInfo.baseUrl}/workspace/${encodeURIComponent(workspace.id)}/engine/reload`, {
      method: "POST",
      headers,
    });
    summary.checks.engineReload = { ok: reload?.ok === true };

    const providers = unwrapOpencode(await opencode.provider.list(), "provider.list");
    summary.checks.providerVisible = JSON.stringify(providers).includes("scnet") || JSON.stringify(providers).includes(llm.modelID);
    if (!summary.checks.providerVisible) throw new Error("SCNet provider is not visible to OpenCode");

    const session = unwrapOpencode(
      await opencode.session.create({ title: "企业资料整理与研究写作", directory: workspaceRoot }),
      "session.create",
    );
    summary.checks.session = { id: session.id };

    unwrapOpencode(
      await opencode.session.promptAsync({
        sessionID: session.id,
        model: { providerID: "scnet", modelID: llm.modelID },
        reasoning_effort: "low",
        tools: { bash: false, edit: false, write: false, read: false },
        system: [
          "你正在进行企业工作台模型连通性验收。",
          "不要调用任何工具，不要读写文件。",
          "不要解释用户意图，不要输出英文，不要输出推理过程。",
          "最终输出必须完全等于：他山模型接入通过。",
        ].join("\n"),
        parts: [{ type: "text", text: "输出且只输出以下句子：他山模型接入通过。" }],
      }),
      "session.promptAsync",
      true,
    );
    summary.checks.promptAccepted = true;

    const assistant = await waitForAssistant(opencode, session.id);
    summary.checks.assistant = assistant;
    if (!assistant.ok) throw new Error(`Assistant text did not arrive. Last preview: ${assistant.preview}`);

    await evaluate(client, `window.location.hash = ${JSON.stringify(`/workspace/${workspace.id}/session/${session.id}`)}`);
    await sleep(6000);
    const visibleText = await evaluate(client, "document.body?.innerText?.slice(0, 4000) ?? ''", 10_000);
    const documentTitle = await evaluate(client, "document.title || ''", 10_000);
    const visibleTextValue = String(visibleText);
    const forbiddenVisible = ["OpenWork", "OpenCode", "New session", "TaShan employee", "Default agent", "数字员工商店"]
      .filter((item) => visibleTextValue.includes(item));
    summary.checks.cdpVisibleText = {
      title: String(documentTitle),
      containsTashanTitle: String(documentTitle).includes("TashanWork"),
      containsAssistantText: visibleTextValue.includes("他山模型接入通过"),
      containsTashanBrand: visibleTextValue.includes("他山"),
      containsProjectSpace: visibleTextValue.includes("当前项目空间") || visibleTextValue.includes("添加项目空间"),
      containsSessionLanguage: visibleTextValue.includes("会话") || visibleTextValue.includes("新会话"),
      containsWorkbenchContext: visibleTextValue.includes("数字员工：按插件调用") && visibleTextValue.includes("当前模型"),
      containsDefaultDigitalEmployee: visibleTextValue.includes("研究写作员工") || visibleTextValue.includes("数字员工"),
      forbiddenVisible,
      containsReasoningPreamble: /The user is asking|specific fixed phrase|reasoning|thinking/i.test(visibleTextValue),
      preview: visibleTextValue.replace(/\s+/g, " ").slice(0, 800),
    };
    const screenshotPath = join(outputDir, "tashan-electron-scnet-demo.png");
    summary.artifacts.screenshot = await captureScreenshot(client, screenshotPath) ? screenshotPath : null;
    summary.artifacts.summary = join(outputDir, "tashan-electron-scnet-demo-summary.json");
    summary.artifacts.visibleText = join(outputDir, "tashan-electron-visible-text.txt");
    await writeFile(summary.artifacts.visibleText, String(visibleText), "utf8");

    if (checkKnowledgeStarter) {
      const knowledgeStarter = await checkKnowledgeStarterPath(client, outputDir);
      summary.checks.knowledgeStarter = knowledgeStarter;
      summary.artifacts.knowledgeStarterScreenshot = knowledgeStarter.screenshot ?? null;
    }

    if (checkPluginDigitalEmployee) {
      const pluginDigitalEmployee = await checkPluginDigitalEmployeePath(client, outputDir);
      summary.checks.pluginDigitalEmployee = pluginDigitalEmployee;
      summary.artifacts.pluginDigitalEmployeeScreenshot = pluginDigitalEmployee.screenshot ?? null;
    }

    if (complexReadmeScreenshot || complexReadmeSubmit) {
      const previousAssistantTexts = complexReadmeSubmit
        ? await listAssistantTexts(opencode, session.id).catch(() => [])
        : [];
      const complexScreenshot = await prepareComplexReadmeScreenshot(client, outputDir, {
        submitTask: complexReadmeSubmit,
      });
      summary.checks.complexReadmeScreenshot = complexScreenshot;
      summary.artifacts.complexReadmeScreenshot = complexScreenshot.screenshot ?? null;

      if (complexReadmeSubmit && complexScreenshot?.ok && complexScreenshot?.startTaskClicked) {
        const complexAssistant = await waitForNewAssistant(opencode, session.id, previousAssistantTexts);
        summary.checks.complexReadmeSubmission = complexAssistant;
        summary.checks.complexReadmeDetailRefocused = await focusKnowledgeEmployeeDetail(client);
        await sleep(3000);
        const complexResponseScreenshot = join(outputDir, "tashanwork-complex-task-response-digital-employee.png");
        summary.artifacts.complexReadmeResponseScreenshot = await captureScreenshot(client, complexResponseScreenshot)
          ? complexResponseScreenshot
          : null;
      }
    }

    const consoleProblems = client.notifications
      .filter((entry) => entry.method === "Log.entryAdded" || entry.method === "Runtime.exceptionThrown")
      .map((entry) => JSON.stringify(entry).slice(0, 800));
    summary.checks.consoleProblemCount = consoleProblems.length;
    if (consoleProblems.length) {
      summary.artifacts.consoleProblems = join(outputDir, "tashan-electron-console-problems.json");
      await writeFile(summary.artifacts.consoleProblems, JSON.stringify(consoleProblems, null, 2), "utf8");
    }

    summary.ok = Boolean(
      summary.checks.openworkServer.running &&
      summary.checks.openworkServer.managedOpencode &&
      summary.checks.workspace.hasOpencodeBaseUrl &&
      summary.checks.engineReload.ok &&
      summary.checks.providerVisible &&
      summary.checks.promptAccepted &&
      summary.checks.assistant.ok &&
      summary.checks.cdpVisibleText.containsTashanTitle &&
      summary.checks.cdpVisibleText.containsAssistantText &&
      summary.checks.cdpVisibleText.containsProjectSpace &&
      summary.checks.cdpVisibleText.containsSessionLanguage &&
      summary.checks.cdpVisibleText.containsWorkbenchContext &&
      summary.checks.cdpVisibleText.containsDefaultDigitalEmployee &&
      summary.checks.cdpVisibleText.forbiddenVisible.length === 0 &&
      !summary.checks.cdpVisibleText.containsReasoningPreamble &&
      (!checkKnowledgeStarter || summary.checks.knowledgeStarter?.ok === true) &&
      (!checkPluginDigitalEmployee || summary.checks.pluginDigitalEmployee?.ok === true) &&
      (!complexReadmeScreenshot || summary.checks.complexReadmeScreenshot?.ok === true) &&
      (!complexReadmeSubmit || summary.checks.complexReadmeSubmission?.ok === true)
    );
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
  } finally {
    summary.finishedAt = new Date().toISOString();
    if (client) client.close();
    if (!keepAlive && child?.pid) stopProcessTree(child.pid);
    if (child?.pid) summary.checks.keepAlive = keepAlive ? { pid: child.pid } : false;
    await writeFile(join(outputDir, "tashan-electron-scnet-demo-summary.json"), JSON.stringify(sanitizeForEvidence(summary), null, 2), "utf8");
    console.log(JSON.stringify({
      ok: summary.ok,
      outputDir,
      screenshot: summary.artifacts.screenshot ?? null,
      assistantPreview: summary.checks.assistant?.preview ?? "",
      cdpVisibleText: summary.checks.cdpVisibleText ?? null,
      error: summary.error,
    }, null, 2));
    if (!summary.ok) process.exitCode = 2;
  }
}

await main();
