# 验收说明

## 当前定位

这个 skill 是从综合 research-nexus 中拆出来的搜索与引用核验部分，并以原 `giiisp-paper-search-apis` 为基础增强。

它不包含：

- PPT 生成、PPTX 构建、模板资产。
- 图像生成、图像编辑、科研配图渲染。
- 非搜索任务的写作、审稿或视觉设计流程。

它包含：

- Giiisp/集思谱论文检索接口 dry-run 请求构造。
- arXiv 官方 API 与 OpenAlex 开放源检索。
- CNKI 请求构造、结果解析、翻页、详情解析和统计。
- 跨平台去重、引用网络、关键词提醒、期刊检查和参考文献格式转换。
- 引用审计输出模板和失败响应处理规则。

## 必须通过

```powershell
python -m py_compile (Get-ChildItem -LiteralPath scripts -Filter *.py | ForEach-Object { $_.FullName })
python -m pytest -q
python scripts/dry_run_paper_search.py --mode oa --query "科研图像生成 文献检索 skill" --format end-to-end-example
python scripts/dry_run_paper_search.py --mode arxiv-author --query "Geoffrey Hinton"
python scripts/search_pipeline.py --query "diffusion model" --platform auto --limit 5
python scripts/paper_search.py --query "diffusion model" --platform giiisp --giiisp-mode title --limit 5
python scripts/paper_search.py --query "diffusion model" --platform giiisp --giiisp-mode title --limit 2 --execute-giiisp
```

预期：

- Giiisp 6 个 mode 的 URL 和 JSON body 正确。
- 所有 dry-run 示例都声明 `no request was sent`。
- 不读取、不打印、不保存任何密钥。
- 不把模拟论文当作真实检索结果。
- `search_pipeline.py` 对 `/first/paper/searchArxiv` 使用 `key/pageNum/pageSize` 请求体。
- `search_pipeline.py` 保留用户原始检索词为第一查询词。
- `paper_search.py --execute-giiisp` 能在接口公开可访问时返回 `giiisp_live_results[].normalized_results`，接口不可用时返回 `verification_status=接口受限` 和失败摘要。
- CNKI HTML 解析、跨平台 DOI 去重与字段回填有自动化测试覆盖。

## 可交付文件

- `SKILL.md`
- `ACCEPTANCE.md`
- `agents/openai.yaml`
- `scripts/dry_run_paper_search.py`
- `scripts/paper_search.py`
- `scripts/search_pipeline.py`
- `scripts/openalex_search.py`
- `scripts/cnki_*.py`
- `scripts/cross_platform_dedup.py`
- `scripts/citation_network.py`
- `scripts/keyword_alert.py`
- `scripts/journal_checker.py`
- `scripts/reference_formatter.py`
- `references/*.md`
- `tests/test_dry_run_paper_search.py`
- `tests/test_search_workflows.py`
- `tests/fixtures/*`
- `examples/*.json`

## 后续真实测试边界

真实 Giiisp 测试必须低频执行，并记录请求摘要、响应摘要、归一化结果和失败处理，不得写入明文 token。若接口返回登录页、验证码、401、403、429 或非 JSON，必须标记为 `接口受限`，不得当作论文命中。
