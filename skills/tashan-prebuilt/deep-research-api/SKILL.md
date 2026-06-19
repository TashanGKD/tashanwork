---
name: deep-research-api
description: Call and verify the Deep Research SSE API for research questions, literature-backed reports, keyword planning, private paper search, references extraction, and evidence-boundary reporting. Use when Codex needs to run or dry-run Deep Research, inspect SSE phases, diagnose empty references or incomplete answers, or produce a source-aware research report from the Deep Research endpoint.
---

# Deep Research API

## Core Rule

Treat Deep Research as an evidence-producing workflow, not a text generator. A usable result must preserve the request, SSE phases, keywords, private-search summary, references, answer status, and evidence limits.

Never present a response as a final research report when:

- `references` is empty.
- `private_search_summary.totalResults` is `0`.
- The stream lacks `done` and only partial `delta` text was received.
- The answer is a clarification question rather than research findings.

In those cases, label the output as `no-evidence`, `clarification`, `references-only`, or `incomplete`.

## Resources

- Use [scripts/deep_research.py](scripts/deep_research.py) for dry-runs and live SSE calls.
- Read [references/deep-research-api.md](references/deep-research-api.md) for the concise API contract.
- Read [references/deep-research-api.zh-CN.md](references/deep-research-api.zh-CN.md) when Chinese integration details, Java examples, frontend notes, or endpoint-by-endpoint descriptions are needed.

## Workflow

1. Clarify the research brief in one or two sentences: question, scope, and expected output.
2. Run the health check when the current availability matters:

```powershell
Invoke-WebRequest -Uri 'http://123.56.218.60:18000/health' -Method GET
```

3. Prefer a dry-run before live calls when the query or endpoint set is uncertain:

```powershell
python scripts/deep_research.py `
  --prompt "large language models for scientific discovery survey" `
  --page-size 3 `
  --endpoints searchArxivByTitle,searchArxivByAbstract `
  --dry-run
```

4. Run the live SSE client and save the aggregated JSON:

```powershell
python scripts/deep_research.py `
  --prompt "large language models for scientific discovery survey" `
  --page-size 3 `
  --endpoints searchArxivByTitle,searchArxivByAbstract `
  --output outputs/deep_research_result.json
```

5. Inspect the JSON before writing conclusions. Report:
   - observed `phases`
   - generated `keywords`
   - `private_search_summary.totalResults`
   - failed endpoints, if any
   - `references` count and most relevant titles
   - `done.ok`, answer length, and whether the report is complete
   - retrieval limits and claims needing full-text verification

## Endpoint Selection

Use the smallest endpoint set that answers the task.

- `searchArxivByTitle`: first-pass high precision for technical topics.
- `searchArxivByAbstract`: broader recall; expect more weakly related papers.
- `searchArticlesByQuery1`: OA title + abstract search; useful for broader academic coverage.
- `searchArxivByArxivNo1`: only when an exact arXiv ID is provided.
- `searchArxiv`: multi-field arXiv search when recall matters.

For a quick validation call, use `--page-size 1 --endpoints searchArxivByTitle`.

## Output Contract

Use this structure for user-facing research outputs:

```text
研究问题：
检索设置：
SSE 阶段：
关键词：
检索命中：
引用数量：
主要结论：
证据映射：
局限与不确定性：
还需要全文核验：
状态：complete / incomplete / references-only / clarification / no-evidence
```

## Failure Handling

- Health check fails: stop and report service unavailable.
- SSE disconnects: keep the partial JSON, last phase, event count, and partial answer.
- Empty references: do not infer citations from the answer text.
- Mixed or weak references: say so and recommend narrower keywords or title-only search.
- Endpoint errors: report endpoint name and error; do not repeatedly retry broad failing requests.
- Slow answer generation: preserve references and mark `incomplete` instead of discarding useful evidence.
