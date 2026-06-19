#!/usr/bin/env python3
"""
Deep Research API client.
Consumes SSE stream from the Deep Research endpoint and writes an aggregated JSON report.
"""

import argparse
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API_BASE = "http://123.56.218.60:18000"
ENDPOINT = f"{API_BASE}/api/research/ask"

DEFAULT_ENDPOINTS = [
    "searchArticlesByQuery1",
    "searchArxivByTitle",
    "searchArxivByAbstract",
    "searchArxivByArxivNo1",
    "searchArxiv",
]


def parse_sse(stream):
    """Parse SSE lines into event dicts."""
    event = None
    data_lines = []
    for line in stream:
        line = line.decode("utf-8").rstrip("\n\r")
        if line == "":
            if event is not None or data_lines:
                data_str = "\n".join(data_lines)
                try:
                    payload = json.loads(data_str) if data_str else {}
                except json.JSONDecodeError:
                    payload = {"raw": data_str}
                yield {"event": event or "message", "data": payload}
            event = None
            data_lines = []
            continue
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_lines.append(line[len("data:"):].strip())


def run_research(prompt, model, keyword_model, page_size, endpoints, output_path):
    body = {
        "prompt": prompt,
        "model": model,
        "keyword_model": keyword_model,
        "page_num": 1,
        "page_size": page_size,
        "endpoint_names": endpoints,
        "include_raw": False,
    }

    req = Request(
        ENDPOINT,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        },
        method="POST",
    )

    collected = {
        "prompt": prompt,
        "model": model,
        "phases": [],
        "keywords": [],
        "private_search_hits": [],
        "private_search_summary": None,
        "references": [],
        "deltas": [],
        "usage": None,
        "done": None,
        "errors": [],
    }

    try:
        with urlopen(req, timeout=300) as resp:
            for evt in parse_sse(resp):
                name = evt["event"]
                data = evt["data"]
                if name == "phase":
                    collected["phases"].append(data)
                elif name == "keywords":
                    collected["keywords"].append(data)
                elif name == "private_search_hit":
                    collected["private_search_hits"].append(data)
                elif name == "private_search_summary":
                    collected["private_search_summary"] = data
                elif name == "references":
                    collected["references"].extend(data.get("references", []))
                elif name == "delta":
                    collected["deltas"].append(data)
                elif name == "usage":
                    collected["usage"] = data
                elif name == "done":
                    collected["done"] = data
                elif name == "error":
                    collected["errors"].append(data)
    except HTTPError as e:
        collected["errors"].append({"http_error": e.code, "message": e.read().decode("utf-8", errors="ignore")})
    except URLError as e:
        collected["errors"].append({"url_error": str(e.reason)})

    # Build a readable report text from deltas
    report_parts = []
    for d in collected["deltas"]:
        if isinstance(d, dict) and "content" in d:
            report_parts.append(d["content"])
    collected["report_text"] = "".join(report_parts)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(collected, f, ensure_ascii=False, indent=2)
        print(json.dumps({"status": "success", "output": output_path, "errors_count": len(collected["errors"])}, ensure_ascii=False))
    else:
        print(json.dumps(collected, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Deep Research API client")
    parser.add_argument("--prompt", required=True, help="Research question or topic")
    parser.add_argument("--model", default="qwen-deep-research", help="Deep research model")
    parser.add_argument("--keyword-model", default="qwen-plus", help="Keyword extraction model")
    parser.add_argument("--page-size", type=int, default=5, help="Papers per endpoint")
    parser.add_argument("--endpoints", default=",".join(DEFAULT_ENDPOINTS), help="Comma-separated endpoint names")
    parser.add_argument("--output", help="Path to write aggregated JSON report")
    parser.add_argument("--dry-run", action="store_true", help="Preview request body without calling API. Outputs JSON with body, estimated cost, and endpoints.")
    args = parser.parse_args()

    body = {
        "prompt": args.prompt,
        "model": args.model,
        "keyword_model": args.keyword_model,
        "page_num": 1,
        "page_size": args.page_size,
        "endpoint_names": [e.strip() for e in args.endpoints.split(",") if e.strip()],
        "include_raw": False,
    }

    if args.dry_run:
        dry_info = {
            "status": "dry_run",
            "endpoint": ENDPOINT,
            "body": body,
            "estimated_cost": f"~{args.page_size * len(body['endpoint_names'])} search requests",
            "note": "Request body constructed but not sent. Use without --dry-run to execute.",
        }
        print(json.dumps(dry_info, ensure_ascii=False, indent=2))
        return

    endpoints = body["endpoint_names"]
    run_research(args.prompt, args.model, args.keyword_model, args.page_size, endpoints, args.output)


if __name__ == "__main__":
    main()
