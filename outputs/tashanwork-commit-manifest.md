# TashanWork Commit Manifest

更新时间：2026-06-19 13:32 CST

## 状态

当前状态：可提交候选，等待用户确认后 commit。不要自动 push。

当前建议 commit message：

```text
feat: prepare TashanWork enterprise workbench fork
```

## 建议纳入提交

### 产品与 UI

- `.gitignore`
- `apps/app/index.html`
- `apps/app/public/tashan-logo.svg`
- `apps/app/public/assets/avatars/v1/**`，共 13 个文件：12 个员工头像 + `manifest.json`
- `apps/app/src/app/tashan-workbench.ts`
- `apps/app/src/app/lib/session-title.ts`
- `apps/app/src/app/utils/index.ts`
- `apps/app/src/components/model-select.tsx`
- `apps/app/src/i18n/index.ts`
- `apps/app/src/i18n/locales/en.ts`
- `apps/app/src/i18n/locales/zh.ts`
- `apps/app/src/react-app/**` 本轮变更文件

### Desktop 与打包

- `apps/desktop/electron-builder.yml`
- `apps/desktop/electron/main.mjs`
- `apps/desktop/electron/runtime.test.mjs`
- `apps/desktop/package.json`

### 发布与验收脚本

- `apps/app/scripts/_util.mjs`
- `scripts/tashan-release-gate.mjs`
- `scripts/tashan-refresh-unpacked-renderer.mjs`
- `scripts/tashan-scnet-e2e.mjs`
- `scripts/tashan-electron-scnet-demo.mjs`
- `scripts/tashan-seed-skills.mjs`

### 预置 skills

- `skills/tashan-prebuilt/**`，当前 13 个 skill 目录、232 个文件。
- `skills/tashan-prebuilt/papercheck/assets/paperchecker-rules/LICENSE` 是 MIT，应随对应资产保留。

Skill 目录计数：

| 目录 | 文件数 | 提交建议 |
|---|---:|---|
| `aigc-detection` | 1 | 提交 |
| `cognitive-profile` | 5 | 提交 |
| `deep-research-api` | 5 | 提交 |
| `giiisp-paper-search-apis` | 32 | 提交 |
| `giiisp-scientific-image-generation` | 19 | 提交 |
| `hallucination-checker` | 1 | 提交 |
| `manim-agent` | 7 | 提交 |
| `papercheck` | 111 | 私有仓库可提交；公开/商业发布前保留 MIT notice 并复核第三方来源 |
| `research-baseline-builder` | 6 | 提交 |
| `scientific-humanization` | 1 | 提交 |
| `scispark` | 7 | 提交 |
| `tashan-world` | 1 | 提交 |
| `visual-deck-builder` | 36 | 提交；其中 gorden_image2pptx 已有 NOTICE |

### 文档

- `outputs/release-engineering-governance.md`
- `outputs/tashanwork-submit-readiness.md`
- `outputs/tashanwork-commit-manifest.md`

## 不纳入提交

- `outputs/loop/**`
- `apps/desktop/dist-electron/**`
- `.env.runtime.local`
- `work/loop-runtime/**`
- 任何截图、CDP 文本、长日志、真实 API key、本地 workspace、打包缓存

`outputs/loop/` 已在 `.gitignore` 中忽略，只作为本地审计证据保留。

## 最终复核命令

```powershell
git status --short --ignored=matching outputs
node scripts\tashan-release-gate.mjs
pnpm --filter @openwork/app typecheck
pnpm --filter @openwork/desktop typecheck:electron
pnpm --filter @openwork/app test:health
pnpm --filter @openwork/app test:sessions
pnpm --filter @openwork/app test:permissions
pnpm --filter @openwork/desktop test
```

## Staging 建议

```powershell
git add .gitignore
git add apps/app/index.html apps/app/public/tashan-logo.svg apps/app/public/assets/avatars/v1
git add apps/app/src/app/tashan-workbench.ts apps/app/src/app/lib/session-title.ts apps/app/src/app/utils/index.ts
git add apps/app/src/components/model-select.tsx apps/app/src/i18n apps/app/src/react-app
git add apps/app/scripts/_util.mjs
git add apps/desktop/electron-builder.yml apps/desktop/electron/main.mjs apps/desktop/electron/runtime.test.mjs apps/desktop/package.json
git add scripts/tashan-release-gate.mjs scripts/tashan-refresh-unpacked-renderer.mjs scripts/tashan-scnet-e2e.mjs scripts/tashan-electron-scnet-demo.mjs scripts/tashan-seed-skills.mjs
git add skills/tashan-prebuilt
git add outputs/release-engineering-governance.md outputs/tashanwork-submit-readiness.md outputs/tashanwork-commit-manifest.md
git status --short
git commit -m "feat: prepare TashanWork enterprise workbench fork"
```

不建议使用 `git add .`，因为这轮有大量本地 evidence 和打包产物，虽然主要路径已 ignore，但显式 add 更可控。

## 用户确认项

1. 是否现在 commit。
2. 是否提交到私有 Tashan GitHub 仓库 `tashanwork`。
3. 是否暂时允许预置 skills 全量进入仓库，尤其是 `papercheck` 资产。
4. 是否本轮继续不处理 exe 图标。
5. 是否只 commit 不 push。
