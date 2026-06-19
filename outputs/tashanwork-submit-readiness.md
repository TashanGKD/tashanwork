# TashanWork 提交准备清单

更新时间：2026-06-19 12:56 CST

## 当前结论

当前 TashanWork 已达到“可提交前候选”状态：桌面目录包、真实模型、可见品牌检查、固定门禁和更宽发布测试均有本地证据。不要自动提交或推送；提交前建议由用户确认提交范围、仓库名和 license/notice 口径。

## 建议 commit 范围

### 1. 产品品牌与企业工作台 UI

- `apps/app/index.html`
- `apps/app/public/tashan-logo.svg`
- `apps/app/public/assets/**`
- `apps/app/src/app/tashan-workbench.ts`
- `apps/app/src/app/lib/session-title.ts`
- `apps/app/src/app/utils/index.ts`
- `apps/app/src/components/model-select.tsx`
- `apps/app/src/i18n/index.ts`
- `apps/app/src/i18n/locales/en.ts`
- `apps/app/src/i18n/locales/zh.ts`
- `apps/app/src/react-app/**`

说明：这是 TashanWork 可见品牌、中文化、数字员工产品层、项目空间/会话/模型上下文和设置页包装。内部 `@openwork/*` 包名不在本轮硬改。

### 2. 桌面壳与 Windows 目录包

- `apps/desktop/electron-builder.yml`
- `apps/desktop/electron/main.mjs`
- `apps/desktop/package.json`

说明：桌面产品名为 `TashanWork`；新增 `package:electron:dir:no-resource-edit`，用于当前 Windows 环境下不改 exe 图标、不触发 winCodeSign symlink 阻塞的目录包。

### 3. 测试与发布验收脚本

- `apps/app/scripts/_util.mjs`
- `apps/desktop/electron/runtime.test.mjs`
- `scripts/tashan-release-gate.mjs`
- `scripts/tashan-refresh-unpacked-renderer.mjs`
- `scripts/tashan-scnet-e2e.mjs`
- `scripts/tashan-electron-scnet-demo.mjs`
- `scripts/tashan-seed-skills.mjs`

说明：这些脚本用于密钥/品牌/`/ee` 门禁、真实模型验收、桌面 CDP 验收、unpacked renderer 刷新和预置 skills 安装验证。`_util.mjs` 和 desktop runtime test 的变更是跨平台测试修复。

### 4. 预置数字员工与 skills

- `skills/tashan-prebuilt/**`

说明：预置技能包和数字员工资源按 Tashan 产品层管理。后续如要发布到公网或商业交付，应补充每个导入技能包的来源、版权和使用许可说明。

### 5. 发布治理文档

- `outputs/release-engineering-governance.md`
- `outputs/tashanwork-submit-readiness.md`

说明：建议把这两个文件提交，作为 fork 初期的工程治理和提交说明。`outputs/loop/` 是自动化运行日志，不建议提交。

## 不建议提交

- `outputs/loop/**`
- `apps/desktop/dist-electron/**`
- `.env.runtime.local`
- 任何真实 API key、运行截图、CDP 文本、长日志、临时 workspace、打包缓存

说明：`outputs/loop/` 包含本地运行证据和截图，适合作为交付审计证据留在本机，不适合进入 GitHub 仓库。

## License / Notice 边界

### 必须保留

- OpenWork 根 LICENSE 和版权声明。
- 第三方依赖 license notice。
- OpenCode / OpenWork runtime 底座归属说明。
- TashanWork 对 OpenWork MIT 底座的 fork / derivative 说明。

### 必须隔离

- OpenWork `/ee`：本轮不接入、不 import、不打包；商业版不能“先放进去”。风险等级：高。
- Magic：只作为功能域参考，不复制代码、品牌、UI、图标、截图、文案或资产。风险等级：高。
- OpenWork/Magic 营销素材、logo、截图、文案：必须替换。风险等级：中到高。

### 当前可接受

- 内部包名、协议、sidecar、缓存目录仍包含 `openwork` / `opencode`，作为 MIT 底座层现实存在。风险等级：低到中。
- 用户可见层必须保持 `TashanWork` / `Tashan CLI` / 中文化口径，并由 CDP 可见文本检查约束。

## OpenWork / OpenCode Allowlist

允许保留：

- `@openwork/*` 内部 package name。
- `apps/server`、`apps/orchestrator`、`apps/opencode-router`、desktop runtime 内部路径。
- `opencode` sidecar 文件名、SDK import、内部 env var 和协议字段。
- `.opencode/` 工作区内部目录。
- release gate 输出中的 `base-layer-brand-reference` warning。

不允许保留在用户可见层：

- `OpenWork`
- `OpenCode`
- `New session`
- `Default agent`
- `数字员工商店`
- `TaShan employee`

## 已通过验收

- `node scripts\tashan-release-gate.mjs`
- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter @openwork/desktop typecheck:electron`
- `pnpm --filter @openwork/app test:health`
- `pnpm --filter @openwork/app test:sessions`
- `pnpm --filter @openwork/app test:permissions`
- `pnpm --filter @openwork/desktop test`
- `pnpm --filter @openwork/desktop package:electron:dir:no-resource-edit`
- `node scripts\tashan-electron-scnet-demo.mjs`

## 当前可接受风险

- 标准 `package:electron:dir` 在当前 Windows 权限下可能因 winCodeSign symlink 失败；本轮使用 `package:electron:dir:no-resource-edit`。
- exe 图标不替换，用户已确认本轮不追。
- `test:permissions` 本地通过但未观察到真实 permission request；真实工具权限仍需后续用带 provider/tool-call 的端到端用例补充。
- 预置 skills 的来源和 license 需要在正式商业发布前逐项补 notice。

## 建议提交信息

```text
feat: prepare TashanWork enterprise workbench fork
```

提交前最后检查：

1. 确认 `.env.runtime.local` 未进入 git。
2. 确认 `outputs/loop/` 未进入 git。
3. 确认 `/ee` 无产品层 import。
4. 确认用户可见层 CDP 文本无旧品牌残留。
5. 确认仓库目标为 Tashan GitHub 的 `tashanwork`。
