# TashanWork 工程化治理与发布标准

更新时间：2026-06-19

## 当前判断

当前状态是“可演示，但未达正式发布”。真实模型、TashanWork 桌面入口、数字员工产品层、预置 skills 和中文化主路径已有运行证据；但正式提交到 Tashan GitHub 前，必须先把工程边界、门禁命令和发布包规则固定下来。

最高风险不是单个功能缺失，而是继续边做边改，把 OpenWork 底座、Tashan 产品层、演示脚本、预置技能包和发布包资产混在一起。后续每轮先过门禁，再加功能。

## 分层边界

| 层 | 允许改动 | 禁止改动 | 当前相关路径 |
|---|---|---|---|
| OpenWork MIT 底座 | 必要品牌壳适配、desktop productName、显示文案适配 | 大面积改 session/runtime/sync/server 协议；强行重命名内部 opencode 路径导致不可运行 | `apps/server`, `apps/orchestrator`, `apps/opencode-router`, `apps/desktop/electron` |
| Tashan 产品层 | 数字员工定义、工作台 starter、中文化、设置页包装、企业演示入口 | 把 Build/Plan 伪装成数字员工；把 `@` 菜单职责改乱 | `apps/app/src/app/tashan-workbench.ts`, `apps/app/src/react-app/**`, `apps/app/src/i18n/**` |
| 数字员工与 skills | employee plugin 元数据、skill 安装脚本、权限策略展示 | 修改 OpenWork 内置 extension registry 来硬改名字；混入 `/ee` | `skills/tashan-prebuilt`, `scripts/tashan-seed-skills.mjs` |
| 验收脚本 | 真实模型 E2E、桌面 CDP、品牌残留检查、unpacked 刷新 | 在日志、截图、summary 中输出明文 API key | `scripts/tashan-scnet-e2e.mjs`, `scripts/tashan-electron-scnet-demo.mjs`, `scripts/tashan-refresh-unpacked-renderer.mjs` |
| 发布包 | electron-builder 正式生成 `win-unpacked`、产物命名、启动稳定性 | 仅复制旧 exe 当正式发布；保留旧入口作为对外交付 | `apps/desktop/electron-builder.yml`, `apps/desktop/dist-electron/win-unpacked` |

## 硬性红线

1. 不接入、不 import、不打包 OpenWork `/ee` 到 TashanWork 产品层。
2. 不把 API key 写入源码、报告、截图、score、status、日志或 automation prompt。
3. 数字员工通过 plugin/employee product layer 表达：`Prompt Persona + Skill + MCP + Plugin + 权限策略 + 模型偏好`。
4. `@` 菜单保持原始职责，不承载数字员工；数字员工入口走插件/工具按钮和设置页。
5. Build/Plan 是执行模式，不是数字员工；只保留在执行模式选择中。
6. 新增他山功能集中在 `tashan-*` 脚本、`tashan-workbench.ts`、i18n 和清晰 UI adapter，不继续散落硬编码。
7. 可见产品层不得残留 `OpenWork`、`OpenCode`、`New session`、`Default agent` 等旧品牌词；内部包名、协议和底座路径可保留但不得直接露给用户。
8. 演示包和正式发布包必须分开标记，不能用“能双击”替代“发布级打包”。

## 发布分级

### 今晚演示包标准

- `TashanWork.exe` 可双击打开。
- 第一屏、会话、设置、模型、数字员工、skills/MCP 主路径中文可用。
- SCNet provider health check 通过，最小 prompt 返回“他山模型接入通过”。
- 可见文本检查无 `OpenWork / OpenCode / New session / Default agent / 数字员工商店`。
- `pnpm --filter @openwork/app typecheck` 通过。
- `scripts/tashan-refresh-unpacked-renderer.mjs` 成功刷新 renderer 和 Electron main。
- 预置 skills 能安装到测试 workspace 的 `.opencode/skills/tashan/*`。

当前状态：达到演示包标准。`TashanWork.exe` 已由 electron-builder 目录包脚本重新生成，并通过桌面 SCNet/CDP 验收。

### 发布候选标准

- 关闭旧桌面进程后，`pnpm --filter @openwork/desktop package:electron:dir` 成功生成干净 `win-unpacked`。
- exe 图标沿用当前底座图标，本轮不作为发布阻塞项；界面内仍使用他山 logo 和 TashanWork 品牌。
- `dist-electron/win-unpacked` 中只保留对外入口 `TashanWork.exe`，旧入口不作为交付物。
- `pnpm --filter @openwork/desktop typecheck:electron` 通过。
- `pnpm --filter @openwork/desktop test` 通过。
- `pnpm --filter @openwork/app test:health`、`test:sessions`、`test:permissions` 通过。
- `node scripts/tashan-electron-scnet-demo.mjs --output <evidence>.json` 通过，并保留截图。
- 品牌残留扫描有 allowlist：内部包名/协议可存在，用户可见字符串必须清零。
- secret scan 无明文真实 key。

## 必跑门禁

```powershell
git status --short --branch
git diff --stat
git diff --name-only
node scripts\tashan-release-gate.mjs
pnpm --filter @openwork/app typecheck
pnpm --filter @openwork/app build
pnpm --filter @openwork/desktop typecheck:electron
pnpm --filter @openwork/app test:health
pnpm --filter @openwork/app test:sessions
pnpm --filter @openwork/app test:permissions
pnpm --filter @openwork/desktop test
```

桌面和真实模型门禁：

```powershell
node scripts\tashan-scnet-e2e.mjs --output outputs\loop\evidence\<timestamp>\scnet-e2e.json
node scripts\tashan-refresh-unpacked-renderer.mjs --summary outputs\loop\evidence\<timestamp>\refresh-summary.json
node scripts\tashan-electron-scnet-demo.mjs --output outputs\loop\evidence\<timestamp>\electron-demo.json
```

正式 unpacked exe：

```powershell
pnpm --filter @openwork/desktop package:electron:dir
```

当前 Windows 环境缺少创建 symlink 的权限时，electron-builder 的 winCodeSign 缓存解压会失败。由于本轮明确不更换 exe 图标，发布候选目录包使用以下可复现脚本，跳过 Windows 资源编辑：

```powershell
pnpm --filter @openwork/desktop package:electron:dir:no-resource-edit
```

该脚本会完整执行 Electron build、renderer build 和 electron-builder `--dir`，但保留当前 exe 图标。2026-06-19 12:01 CST 已验证生成 `apps/desktop/dist-electron/win-unpacked/TashanWork.exe`，随后桌面 SCNet/CDP 验收通过。

## 当前主要技术债

| 风险 | 等级 | 说明 | 收束方式 |
|---|---:|---|---|
| 标准 electron-builder 打包可能触发 winCodeSign 权限问题 | 中 | 当前 Windows 环境缺少 symlink 权限时，`package:electron:dir` 可能在 winCodeSign 解压阶段失败 | 本轮不换图标，使用 `package:electron:dir:no-resource-edit` 生成目录包；图标资源编辑后续单独处理 |
| exe 图标未替换 | 低 | 用户已确认本轮不换 exe 图标；界面内 logo 和品牌仍需保留他山口径 | 不作为发布阻塞项，后续如需要再单独处理 |
| 可见品牌残留仍需 allowlist | 中 | 内部路径大量 OpenWork/OpenCode 合理存在，但产品可见层必须清零 | 使用 `tashan-release-gate.mjs` + CDP 可见文本检查 |
| Tashan product layer 仍散落在多个 UI 文件 | 中 | 当前改动覆盖设置页、composer、sidebar、i18n | 后续新增只进 `tashan-workbench.ts` 和 adapter，不继续扩散 |
| `/ee` 在 monorepo workspace 中仍存在 | 中 | pnpm workspace 包含 `ee/*`，但路线冻结为不接入 | 发布脚本和 import scan 禁止他山层引用 `/ee` |
| 预置 skills 来源复杂 | 中 | zip 导入技能包可用，但需 notice/license 和最小校验 | skills 作为预置资源管理，发布前补 notice |
| 内部包名仍为 `@openwork/*` | 低 | 这是 fork 底座现实，不应今晚硬改 | 用户可见层改为 TashanWork，内部包名后续系统性迁移 |

## 下一轮唯一目标

先做提交材料，不继续加功能：

1. 整理建议 commit 范围和文件分组。
2. 明确 notice/license 边界，尤其是 OpenWork MIT、第三方依赖、Magic 仅功能参考、`/ee` 不接入。
3. 列出内部 OpenWork/OpenCode allowlist：底座包名、协议、sidecar、内部路径可保留，用户可见层不可露出。
4. 确认 `outputs/` 中哪些证据进入仓库，哪些仅本地保留。
