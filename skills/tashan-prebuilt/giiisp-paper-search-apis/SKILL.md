---
name: giiisp-paper-search-apis
description: 调用或构造 Giiisp/集思谱论文检索请求，并按任务路由到 arXiv、OpenAlex、CNKI、跨平台去重、引用网络、期刊检查和引用审计。用于文献检索、文献初筛、arXiv 定位、中文论文检索、开放源补充和引用核验。
---

# Giiisp Paper Search APIs

## 定位

这个 skill 是搜索与引用核验子系统，不包含 PPT 生成、图像生成、科研配图渲染或视觉设计资产。

它负责三件事：

- 把用户问题路由到合适的 Giiisp 论文检索 POST 接口，默认只做 dry-run 请求构造。
- 在 Giiisp 登录态或鉴权不可用时，使用 arXiv、OpenAlex、CNKI 等开放或半开放检索链路补充候选。
- 把结果整理成可核验的论文候选表、引用审计表、去重结果或参考文献格式。

## 总原则

1. 先明确检索目标：主题发现、arXiv 定位、作者检索、中文数据库检索、引用审计、去重、期刊检查或格式转换。
2. Giiisp 接口默认不真实调用，只构造请求体、curl 或 dry-run 输出；当前环境确认接口可公开返回 JSON 时，可用 `paper_search.py --execute-giiisp` 做低频真实查询。
3. 任何响应不能被确认为论文 JSON 结果时，都不得当作论文命中。401、403、429、HTML 登录页、验证码页、业务错误都标记为 `接口受限`。
4. 开放源回退结果必须标记 `非 Giiisp 结果`，不能混写成 Giiisp 命中。
5. 不编造引用量、期刊分区、DOI、全文内容或不存在的论文。

## 任务路由

| 用户要做什么 | 首选工具 |
|---|---|
| 构造 Giiisp OA 论文检索请求 | `scripts/dry_run_paper_search.py --mode oa` |
| 按摘要/方法词查 arXiv | `scripts/dry_run_paper_search.py --mode arxiv-abstract` |
| 已有 arXiv 编号 | `scripts/dry_run_paper_search.py --mode arxiv-no` |
| 同时按题名、作者、摘要词查 arXiv | `scripts/dry_run_paper_search.py --mode arxiv` |
| 查重或核对题名 | `scripts/dry_run_paper_search.py --mode arxiv-title` |
| 按作者名查 arXiv | `scripts/dry_run_paper_search.py --mode arxiv-author` |
| 一键生成检索方案 | `scripts/search_pipeline.py` |
| 直接查 arXiv 官方 API | `scripts/paper_search.py --platform arxiv` |
| 查 OpenAlex 论文、作者、概念、BibTeX/CSV | `scripts/openalex_search.py` |
| 中文 CNKI 检索请求构造 | `scripts/cnki_search.py` |
| 解析 CNKI 结果页 HTML | `scripts/cnki_parse_results.py` |
| CNKI 翻页/排序/详情解析/统计 | `scripts/cnki_paginate.py`, `scripts/cnki_paper_detail.py`, `scripts/cnki_journal_stats.py` |
| 合并 Giiisp/OpenAlex/CNKI 等结果并去重 | `scripts/cross_platform_dedup.py` |
| 分析引用网络或核心论文 | `scripts/citation_network.py` |
| 检查中文期刊层级或可疑期刊 | `scripts/journal_checker.py` |
| 参考文献格式转换 | `scripts/reference_formatter.py` |
| 关键词订阅与增量提醒 | `scripts/keyword_alert.py` |

## Giiisp 接口矩阵

基址为 `https://giiisp.com`。所有业务接口使用 `POST` 和 JSON body，不把检索参数放在 URL query。

| mode | 接口 | 请求体 |
|---|---|---|
| `oa` | `/first/oaPaper/searchArticlesByQuery1` | `{"titleAndAbs": ["query"]}` |
| `arxiv-abstract` | `/first/paper/searchArxivByAbstract` | `{"key": "query", "pageNum": 1, "pageSize": 10}` |
| `arxiv-no` | `/first/paper/searchArxivByArxivNo1` | `{"key": "2301.00001", "pageNum": 1, "pageSize": 10}` |
| `arxiv` | `/first/paper/searchArxiv` | `{"key": "query", "pageNum": 1, "pageSize": 10}` |
| `arxiv-title` | `/first/paper/searchArxivByTitle` | `{"key": "query", "pageNum": 1, "pageSize": 10}` |
| `arxiv-author` | `/first/paper/searchArxivByAuthor` | `{"key": "author name", "pageNum": 1, "pageSize": 10}` |

分页默认 `pageNum=1`、`pageSize=10`。只有用户需要扩展结果时才继续翻页。

## 输出格式

每次检索输出短表，至少包含：

| 字段 | 要求 |
|---|---|
| 检索目标 | 用户原始问题的简写 |
| 实际检索词 | 写出真实传入的词 |
| 来源/接口 | Giiisp 接口路径或开放源名称 |
| 论文 | 题名、作者、年份、来源 |
| 链接 | arXiv、DOI、开放论文页或来源页 |
| 摘要依据 | 只摘核心命中点 |
| 状态 | `已核验` / `待核验` / `接口受限` / `非 Giiisp 结果` / `不支持` |
| 下一步 | 翻页、换词、交叉核验或停止 |

内部归一化字段推荐：

```json
{
  "title": "Paper title",
  "authors": ["First Author"],
  "year": 2026,
  "venue": "arXiv",
  "abstract": "Abstract text from source.",
  "doi": null,
  "arxiv_id": "2601.01234",
  "url": "https://arxiv.org/abs/2601.01234",
  "pdf_url": "https://arxiv.org/pdf/2601.01234",
  "source_api": "/first/paper/searchArxivByTitle",
  "match_reason": "Title or abstract matches the requested method phrase.",
  "verification_status": "待核验"
}
```

## 引用审计模板

引用审计必须把原文主张、候选论文和核验动作放在同一行：

| 原文主张 | 引用/占位符 | 检索词 | 候选论文 | 证据字段 | 链接 | 状态 | 处理意见 |
|---|---|---|---|---|---|---|---|
| 需要支撑的具体句子 | `[?]`、DOI、arXiv 或作者年份 | 实际传入接口的词 | 题名、作者、年份、来源 | 标题/摘要/DOI/编号命中点 | DOI、arXiv 或来源页 | 已核验 / 待核验 / 不支持 / 接口受限 | 保留、替换、补充引用、删除主张或改写 |

审计结论：

- `已核验`：题名、作者/年份和 DOI/arXiv/来源页能互相对上，摘要或全文元数据支持原文主张。
- `待核验`：元数据看起来匹配，但缺少 DOI、全文页、作者年份或关键摘要字段。
- `不支持`：候选论文与原文主张不一致，或只能支持更弱说法。
- `接口受限`：Giiisp 登录态、非 JSON、401/403/429 或网络限制导致无法核验。
- `非 Giiisp 结果`：来自 arXiv、OpenAlex、Semantic Scholar、Crossref、CNKI 等回退源。

## 常用命令

Dry-run Giiisp 请求：

```powershell
python scripts/dry_run_paper_search.py --mode arxiv-title --query "large language model scientific discovery"
```

输出模拟归一化结果：

```powershell
python scripts/dry_run_paper_search.py --mode arxiv-title --query "large language model scientific discovery" --format normalized-example
```

一键生成检索方案：

```powershell
python scripts/search_pipeline.py --query "diffusion model medical image generation" --platform auto --limit 10
```

直接查 arXiv 官方 API：

```powershell
python scripts/paper_search.py --query "diffusion model" --platform arxiv --limit 10
```

真实调用 Giiisp 并归一化候选：

```powershell
python scripts/paper_search.py --query "diffusion model" --platform giiisp --giiisp-mode title --limit 2 --execute-giiisp
```

查 OpenAlex：

```powershell
python scripts/openalex_search.py --action search --query "large language model scientific discovery" --per-page 20 --output markdown
```

构造 CNKI 检索：

```powershell
python scripts/cnki_search.py --query "高校图书馆 智慧服务" --mode basic --year-start 2020 --year-end 2026 --source journal
```

合并去重：

```powershell
python scripts/cross_platform_dedup.py --inputs giiisp_results.json openalex_results.json cnki_results.json --output deduped.json --similarity-threshold 0.90
```

格式转换：

```powershell
python scripts/reference_formatter.py --input papers.json --format gbt7714-seq
```

## 失败处理

| 响应现象 | 判断 | 处理 |
|---|---|---|
| HTTP `401` / `403` | 登录态、权限或鉴权缺失 | 标记 `接口受限`，不要反复重试；改用开放源回退 |
| HTTP `429` | 频率限制 | 标记 `接口受限`，说明需要降频或稍后再试；不要并发补打 |
| `Content-Type` 是 `text/html` | 登录页、验证码页或错误页 | 不解析为论文；摘录页面标题或前 120 字作为失败摘要 |
| JSON 有 `code`、`success`、`message`，但无结果数组 | 业务失败或空结果 | 保留原始错误字段，状态写 `接口受限` 或 `待核验` |
| 网络超时 / DNS / TLS 错误 | 当前环境无法访问 | 标记 `接口受限`，输出开放源回退 |

## 参考文件

- `references/search-api-guide.md`：Giiisp、OpenAlex、arXiv 接口细节。
- `references/retrieval-guide.md`：CNKI、万方、维普检索式和同义词扩展。
- `references/cnki-dom-guide.md`：CNKI DOM、选择器、反爬和导出结构。
- `references/reference-audit-guide.md`：引用审计流程和 Giiisp 联合验证。
- `references/citation-guide.md`：参考文献格式与导出。
- `references/case-retrieval-guide.md`：相似参考论文/案例检索思路。

## 验证

```powershell
python -m pytest tests/test_dry_run_paper_search.py
python scripts/dry_run_paper_search.py --mode oa --query "科研图像生成 文献检索 skill" --format end-to-end-example
python scripts/search_pipeline.py --query "diffusion model" --platform auto --limit 5
```
