#!/usr/bin/env python3
"""
Multi-platform paper search with query expansion.
Supports Giiisp (request construction), OpenAlex (direct API), and arXiv official API.
"""

import argparse
import json
import sys
import urllib.parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SYNONYM_DB = {
    "large language model": ["large language model", "LLM", "GPT", "transformer-based model"],
    "llm": ["LLM", "large language model", "GPT"],
    "deep learning": ["deep learning", "neural network", "representation learning", "DNN"],
    "neural network": ["neural network", "deep learning", "DNN"],
    "natural language processing": ["natural language processing", "NLP", "computational linguistics"],
    "nlp": ["NLP", "natural language processing", "text mining"],
    "computer vision": ["computer vision", "image recognition", "visual understanding", "CV"],
    "reinforcement learning": ["reinforcement learning", "RL", "policy gradient"],
    "graph neural network": ["graph neural network", "GNN", "graph convolutional network", "GCN"],
    "diffusion model": ["diffusion model", "score-based generative model", "denoising diffusion probabilistic model"],
    "attention mechanism": ["attention mechanism", "self-attention", "multi-head attention"],
    "transformer": ["transformer", "transformer model", "attention-based model"],
    "multimodal": ["multimodal", "cross-modal", "vision-language", "multi-modal learning"],
    "machine learning": ["machine learning", "ML", "statistical learning", "pattern recognition"],
    "self-supervised learning": ["self-supervised learning", "contrastive learning", "pretext task learning"],
    "federated learning": ["federated learning", "distributed learning", "privacy-preserving machine learning"],
    "knowledge graph": ["knowledge graph", "knowledge network", "semantic network", "ontology"],
    "object detection": ["object detection", "instance segmentation", "object recognition"],
    "semantic segmentation": ["semantic segmentation", "image segmentation", "pixel-level classification"],
    "meta learning": ["meta learning", "learning to learn", "few-shot learning", "MAML"],
    "transfer learning": ["transfer learning", "domain adaptation", "fine-tuning"],
    "explainable ai": ["explainable AI", "XAI", "interpretable machine learning"],
}

GIIISP_BASE = "https://giiisp.com"
ARXIV_BASE = "http://export.arxiv.org/api/query"


def expand_query(query, enable=True):
    if not enable:
        return [query]
    query_lower = query.lower().strip()
    expanded = [query]
    if query_lower in SYNONYM_DB:
        expanded.extend(SYNONYM_DB[query_lower])
    for key, synonyms in SYNONYM_DB.items():
        if key in query_lower and key != query_lower:
            expanded.extend(synonyms)
    seen = set()
    result = []
    for w in expanded:
        w_norm = w.lower().strip()
        if w_norm not in seen:
            seen.add(w_norm)
            result.append(w.strip())
    return result


def is_arxiv_number(s):
    import re
    return bool(re.match(r"^\d{4}\.\d{4,5}(v\d+)?$", s.strip()))


def build_giiisp_requests(query, limit=10, mode="all"):
    """Construct Giiisp request bodies and curl commands without executing."""
    requests = []
    endpoint_specs = {
        "title": (
            "searchArxivByTitle",
            f"{GIIISP_BASE}/first/paper/searchArxivByTitle",
            {"pageNum": 1, "pageSize": limit, "key": query},
            "Title search for high relevance",
        ),
        "abstract": (
            "searchArxivByAbstract",
            f"{GIIISP_BASE}/first/paper/searchArxivByAbstract",
            {"pageNum": 1, "pageSize": limit, "key": query},
            "Abstract search for broader recall",
        ),
        "arxiv": (
            "searchArxiv",
            f"{GIIISP_BASE}/first/paper/searchArxiv",
            {"pageNum": 1, "pageSize": limit, "key": query},
            "Multi-field fallback",
        ),
        "author": (
            "searchArxivByAuthor",
            f"{GIIISP_BASE}/first/paper/searchArxivByAuthor",
            {"pageNum": 1, "pageSize": limit, "key": query},
            "Author search",
        ),
        "oa": (
            "searchArticlesByQuery1",
            f"{GIIISP_BASE}/first/oaPaper/searchArticlesByQuery1",
            {"titleAndAbs": [query]},
            "OA title and abstract search",
        ),
    }

    if mode == "arxiv-no" or (mode == "all" and is_arxiv_number(query)):
        requests.append({
            "name": "searchArxivByArxivNo1",
            "url": f"{GIIISP_BASE}/first/paper/searchArxivByArxivNo1",
            "body": {"pageNum": 1, "pageSize": limit, "key": query},
            "note": "Exact arXiv number match",
        })
        return requests

    modes = ["title", "abstract", "arxiv", "oa"] if mode == "all" else [mode]
    for selected in modes:
        name, url, body, note = endpoint_specs[selected]
        requests.append({"name": name, "url": url, "body": body, "note": note})
    return requests


def parse_year(value):
    if not value:
        return None
    text = str(value)
    for token in text.replace("/", "-").split("-"):
        if len(token) == 4 and token.isdigit():
            return int(token)
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def normalize_authors(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    separators = [",", ";", "，", "；"]
    text = str(value)
    for sep in separators[1:]:
        text = text.replace(sep, separators[0])
    return [part.strip() for part in text.split(separators[0]) if part.strip()]


def normalize_arxiv_id(item):
    value = item.get("arxiv_id") or item.get("arxivId") or item.get("arxivNo") or item.get("arvixNo") or item.get("mainArxivNo")
    if not value:
        return None
    text = str(value).strip()
    return text.replace("arXiv:", "").replace("arxiv:", "").strip()


def normalize_giiisp_item(item, source_api, query):
    arxiv_id = normalize_arxiv_id(item)
    url = item.get("url") or item.get("paperUrl") or item.get("htmlUrl") or item.get("sourceUrl")
    if not url and arxiv_id:
        url = f"https://arxiv.org/abs/{arxiv_id}"
    abstract = item.get("abstract") or item.get("summary") or item.get("abs") or item.get("paperAbstract") or item.get("description")
    title = item.get("title") or item.get("paperTitle") or item.get("articleTitle") or item.get("name")
    return {
        "title": title.strip() if isinstance(title, str) else title,
        "authors": normalize_authors(item.get("authors") or item.get("author") or item.get("authorList") or item.get("creator")),
        "year": parse_year(item.get("year") or item.get("publishYear") or item.get("published") or item.get("created") or item.get("releaseDate")),
        "venue": item.get("venue") or item.get("journal") or item.get("source") or item.get("publication") or "arXiv",
        "abstract": abstract.strip() if isinstance(abstract, str) else abstract,
        "doi": item.get("doi") or item.get("DOI"),
        "arxiv_id": arxiv_id,
        "url": url,
        "pdf_url": item.get("pdf_url") or item.get("pdfUrl") or item.get("pdf") or item.get("fullTextUrl"),
        "source_api": source_api,
        "match_reason": f"Giiisp result returned for query: {query}",
        "verification_status": "待核验",
    }


def extract_giiisp_records(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("data", "records", "rows", "list", "result", "results"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = extract_giiisp_records(value)
            if nested:
                return nested
    return []


def execute_giiisp_request(request_spec, query):
    req = Request(
        request_spec["url"],
        data=json.dumps(request_spec["body"], ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read().decode("utf-8", errors="replace")
            if "json" not in content_type.lower():
                return {
                    "source_api": urllib.parse.urlparse(request_spec["url"]).path,
                    "request_body": request_spec["body"],
                    "verification_status": "接口受限",
                    "failure": {
                        "http_status": resp.status,
                        "content_type": content_type,
                        "raw_excerpt": raw[:300],
                    },
                }
            payload = json.loads(raw)
            records = extract_giiisp_records(payload)
            source_api = urllib.parse.urlparse(request_spec["url"]).path
            return {
                "source_api": source_api,
                "request_body": request_spec["body"],
                "http_status": resp.status,
                "giiisp_code": payload.get("code") if isinstance(payload, dict) else None,
                "giiisp_message": payload.get("msg") or payload.get("message") if isinstance(payload, dict) else None,
                "count": len(records),
                "normalized_results": [normalize_giiisp_item(item, source_api, query) for item in records],
                "verification_status": "待核验",
            }
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        return {
            "source_api": urllib.parse.urlparse(request_spec["url"]).path,
            "request_body": request_spec["body"],
            "verification_status": "接口受限",
            "failure": {
                "http_status": e.code,
                "content_type": e.headers.get("Content-Type", "") if e.headers else "",
                "raw_excerpt": raw[:300],
            },
        }
    except (URLError, TimeoutError, json.JSONDecodeError) as e:
        return {
            "source_api": urllib.parse.urlparse(request_spec["url"]).path,
            "request_body": request_spec["body"],
            "verification_status": "接口受限",
            "failure": {"message": str(e)},
        }


def search_arxiv(query, limit, year_start, year_end):
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": min(limit, 100),
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    if year_start and year_end:
        params["search_query"] = f"all:{query} AND submittedDate:[{year_start}0101 TO {year_end}1231]"
    elif year_start:
        params["search_query"] = f"all:{query} AND submittedDate:[{year_start}0101 TO 99991231]"
    elif year_end:
        params["search_query"] = f"all:{query} AND submittedDate:[00000101 TO {year_end}1231]"

    full_url = ARXIV_BASE + "?" + urllib.parse.urlencode(params)
    try:
        with urlopen(Request(full_url, method="GET"), timeout=60) as resp:
            import xml.etree.ElementTree as ET
            xml_data = resp.read().decode("utf-8")
            root = ET.fromstring(xml_data)
            ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
            results = []
            for entry in root.findall("atom:entry", ns):
                title = entry.find("atom:title", ns)
                summary = entry.find("atom:summary", ns)
                published = entry.find("atom:published", ns)
                authors = entry.findall("atom:author/atom:name", ns)
                id_elem = entry.find("atom:id", ns)
                pdf_link = entry.find("atom:link[@title='pdf']", ns)
                results.append({
                    "title": title.text.strip().replace("\n", " ") if title is not None else None,
                    "authors": [a.text for a in authors],
                    "year": published.text[:4] if published is not None else None,
                    "venue": "arXiv",
                    "abstract": summary.text.strip() if summary is not None else None,
                    "arxiv_id": id_elem.text.split("/")[-1] if id_elem is not None else None,
                    "open_access_pdf": pdf_link.get("href") if pdf_link is not None else None,
                    "source": "arxiv",
                })
            return {"status": "success", "platform": "arxiv", "count": len(results), "results": results}
    except Exception as e:
        return {"status": "error", "platform": "arxiv", "message": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Multi-platform paper search")
    parser.add_argument("--query", required=True, help="Search keywords or arXiv ID")
    parser.add_argument("--platform", default="auto", choices=["giiisp", "arxiv", "auto"], help="Search platform")
    parser.add_argument("--giiisp-mode", default="all", choices=["all", "title", "abstract", "arxiv", "arxiv-no", "author", "oa"], help="Giiisp endpoint family for request construction")
    parser.add_argument("--execute-giiisp", action="store_true", help="Send the constructed Giiisp POST request(s) and normalize real JSON results")
    parser.add_argument("--limit", type=int, default=10, help="Max results")
    parser.add_argument("--year-start", help="Start year filter")
    parser.add_argument("--year-end", help="End year filter")
    parser.add_argument("--expand", type=lambda x: x.lower() == "true", default=True, help="Enable synonym expansion")
    parser.add_argument("--output", help="Path to write results JSON")
    args = parser.parse_args()

    expanded = expand_query(args.query, args.expand)
    primary_query = expanded[0]

    output = {
        "query": args.query,
        "expanded_queries": expanded,
        "platform": args.platform,
        "results": [],
    }

    if args.platform == "giiisp":
        requests = build_giiisp_requests(primary_query, args.limit, args.giiisp_mode)
        output["giiisp_requests"] = requests
        if args.execute_giiisp:
            output["giiisp_live_results"] = [execute_giiisp_request(req, primary_query) for req in requests]
            output["note"] = "Giiisp requests executed. Treat results as candidates until DOI/arXiv/source metadata is cross-checked."
        else:
            output["note"] = "Giiisp requests constructed but not executed. Add --execute-giiisp to send real POST requests when appropriate."
    elif args.platform == "arxiv":
        res = search_arxiv(primary_query, args.limit, args.year_start, args.year_end)
        output["results"].append(res)
    elif args.platform == "auto":
        res_arxiv = search_arxiv(primary_query, args.limit, args.year_start, args.year_end)
        if res_arxiv["status"] == "success":
            output["results"].append(res_arxiv)
        requests = build_giiisp_requests(primary_query, args.limit, args.giiisp_mode)
        output["giiisp_requests"] = requests
        if args.execute_giiisp:
            output["giiisp_live_results"] = [execute_giiisp_request(req, primary_query) for req in requests]
            output["note"] = "arXiv searched directly and Giiisp requests executed. For OpenAlex deep search use openalex_search.py."
        else:
            output["note"] = "arXiv searched directly. For OpenAlex deep search use openalex_search.py. Giiisp requests constructed for manual execution if needed."

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(json.dumps({"status": "success", "output": args.output, "total_results": sum(r.get("count", 0) for r in output["results"])}, ensure_ascii=False))
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
