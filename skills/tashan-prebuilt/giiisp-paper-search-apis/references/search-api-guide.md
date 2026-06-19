# Search API Guide

## Overview

This guide covers three search backends used by the paper-search module:

1. **Giiisp** (OA disk-array + arXiv wrappers)
2. **OpenAlex** (free, 200M+ works, no auth)
3. **arXiv Official API** (free, no auth)

## Giiisp API

Base URL: `https://giiisp.com`

All endpoints are `POST` with JSON body and `Content-Type: application/json`.

### Interface 1: OA Disk-Array Title+Abstract

```text
POST /first/oaPaper/searchArticlesByQuery1
```

Body:
```json
{"titleAndAbs": ["transformer", "attention"]}
```

### Interface 2: arXiv Abstract

```text
POST /first/paper/searchArxivByAbstract
```

Body:
```json
{"pageNum": 1, "pageSize": 10, "key": "large language model reasoning"}
```

### Interface 3: arXiv Number Exact

```text
POST /first/paper/searchArxivByArxivNo1
```

Body:
```json
{"pageNum": 1, "pageSize": 20, "key": "2301.00001"}
```

### Interface 4: arXiv Multi-Field

```text
POST /first/paper/searchArxiv
```

Body:
```json
{"pageNum": 1, "pageSize": 10, "key": "diffusion model"}
```

Server maps `key` to `arxivNo` / `title` / `author` / `paperAbstract` / `comments` / `subjects`.

### Interface 5: arXiv Title

```text
POST /first/paper/searchArxivByTitle
```

Same body shape as Interface 2.

### Interface 6: arXiv Author

```text
POST /first/paper/searchArxivByAuthor
```

Body:
```json
{"pageNum": 1, "pageSize": 10, "key": "Geoffrey Hinton"}
```

### Interface 7: arXiv Official API Fallback

```text
GET https://export.arxiv.org/api/query?search_query=all:...&start=0&max_results=...
```

Direct arXiv API; no Giiisp auth needed.

### Selection Logic

| User input | Interface |
|------------|-----------|
| arXiv ID provided | 3 |
| OA / disk-array requested | 1 |
| Author name provided | 6 |
| Title-only search | 5 |
| Abstract-only search | 2 |
| Default | 4 (multi-field) |

### Capability Boundary

- Only OA disk-array and arXiv English papers.
- No CNKI / Wanfang / VIP access.
- No full-text download.
- No citation counts or citation networks.

## OpenAlex API

Base URL: `https://api.openalex.org`

No authentication required. Optional: add `mailto=you@example.com` to be polite.

### Search Works

```text
GET /works?search=<query>&per-page=<n>&page=<p>
```

### Filter by Year

```text
GET /works?search=<query>&filter=from_publication_date:2020,to_publication_date:2025
```

### Response Fields

| Field | Description |
|-------|-------------|
| `display_name` | Title |
| `authorships` | Author list with affiliations |
| `publication_year` | Year |
| `host_venue.display_name` | Venue |
| `abstract` | Abstract (inverted index; may need reconstruction) |
| `doi` | DOI |
| `open_access.oa_url` | Open access PDF URL |
| `cited_by_count` | Citation count |

## arXiv Official API

Base URL: `http://export.arxiv.org/api/query`

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `search_query` | Search string with prefix syntax (`ti:`, `au:`, `abs:`, `all:`) |
| `start` | Offset |
| `max_results` | Max 100 per request |
| `sortBy` | `relevance`, `lastUpdatedDate`, `submittedDate` |
| `sortOrder` | `ascending`, `descending` |

### Prefix Syntax

| Prefix | Field |
|--------|-------|
| `ti:` | Title |
| `au:` | Author |
| `abs:` | Abstract |
| `all:` | All fields |

Example: `search_query=all:diffusion+model+AND+ti:medical`

## Deduplication Rules

When combining results from multiple platforms:

1. Normalize DOI and arXiv ID as primary keys.
2. Fuzzy-match titles (Levenshtein distance < 5) when IDs missing.
3. Prefer OpenAlex metadata for citation counts.
4. Prefer arXiv direct links for open-access PDFs.
