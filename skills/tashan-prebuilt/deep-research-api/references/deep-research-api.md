# Deep Research API Reference

## Base URL

```text
http://123.56.218.60:18000
```

## Health Check

```text
GET /health
```

## Main Endpoint

```text
POST /api/research/ask
Content-Type: application/json
Accept: text/event-stream
```

## Request Body

```json
{
  "prompt": "研究人工智能在教育评估中的应用",
  "model": "qwen-deep-research",
  "keyword_model": "qwen-plus",
  "page_num": 1,
  "page_size": 5,
  "endpoint_names": [
    "searchArticlesByQuery1",
    "searchArxivByTitle",
    "searchArxivByAbstract",
    "searchArxivByArxivNo1",
    "searchArxiv"
  ],
  "include_raw": false
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Research topic or question |
| `model` | string | Yes | Deep research model; default `qwen-deep-research` |
| `keyword_model` | string | No | Keyword extraction model; e.g., `qwen-plus` |
| `page_num` | number | No | Pagination page number |
| `page_size` | number | No | Results per endpoint per call |
| `endpoint_names` | string[] | No | Enabled search endpoints |
| `include_raw` | boolean | No | Whether to return raw search results |

## SSE Event Types

### `phase`

Current research phase.

```json
{"phase": "KeywordPlanning", "status": "finished"}
```

Common phases: `KeywordPlanning`, `PrivateSearch`, `ResearchPlanning`, `WebResearch`, `answer`, `KeepAlive`.

Common statuses: `typing`, `finished`, `streamingQueries`, `streamingWebResult`, `WebResultFinished`.

### `keywords`

Extracted English keywords.

```json
{"keywords": ["AI in education", "intelligent assessment"], "keywordModel": "qwen-plus"}
```

### `private_search_hit`

Search hit from a specific endpoint.

```json
{"endpoint": "searchArxivByTitle", "keyword": "AI in education", "count": 2, "elapsedMs": 812.3}
```

### `private_search_summary`

Aggregated search summary.

```json
{
  "totalResults": 10,
  "totalElapsedMs": 5230.5,
  "endpointTimings": [
    {"endpoint": "searchArxivByTitle", "calls": 5, "successCalls": 5, "failedCalls": 0, "totalElapsedMs": 5230.5, "avgElapsedMs": 1046.1}
  ]
}
```

### `references`

Final cited sources.

```json
{"references": [{"title": "Paper Title", "description": "Abstract", "url": "https://example.com/paper"}]}
```

### `delta`

Real-time report content fragments.

```json
{"phase": "answer", "status": "typing", "content": "本研究重点分析了人工智能在教育评估中的应用路径。"}
```

### `usage`

Token consumption.

```json
{"usage": {"input_tokens": 100, "output_tokens": 200, "total_tokens": 300}, "requestId": "request-id"}
```

### `done`

End of stream.

```json
{"ok": true, "answer": "完整研究报告正文", "totalElapsedMs": 27066.06}
```

### `error`

Failure event.

```json
{"message": "错误信息"}
```

## Search Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `searchArticlesByQuery1` | POST | Title + abstract search on OA disk-array |
| `searchArxivByTitle` | POST | arXiv title search |
| `searchArxivByAbstract` | POST | arXiv abstract search |
| `searchArxivByArxivNo1` | POST | Exact arXiv number lookup |
| `searchArxiv` | POST | Multi-field arXiv search |

## Recommended Search Strategy

1. Split keywords from the research question.
2. Use `searchArxivByTitle` for high-relevance first pass.
3. Use `searchArxivByAbstract` or `searchArticlesByQuery1` for broader recall.
4. Use `searchArxiv` as comprehensive supplement.
5. Use `searchArxivByArxivNo1` only when the user provides a specific arXiv ID.
6. Deduplicate, rank, and normalize before feeding into report generation.

## Frontend Integration Tips

- Render `phase` and `status` in a top status bar.
- Accumulate `delta.content` into the report body in real time.
- Display keywords, references, and endpoint timings in auxiliary panels.
- Use `done.totalElapsedMs` for total duration.
