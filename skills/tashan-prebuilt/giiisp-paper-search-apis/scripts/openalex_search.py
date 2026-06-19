#!/usr/bin/env python3
"""
OpenAlex API 搜索脚本
支持论文搜索、单篇详情、作者搜索、作者详情、学科概念搜索
"""

import argparse
import json
import sys
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://api.openalex.org"


def api_get(endpoint, params=None):
    """发送 GET 请求到 OpenAlex API"""
    url = f"{BASE_URL}{endpoint}"
    if params:
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        url = f"{url}?{query}"

    req = urllib.request.Request(url, headers={
        "User-Agent": "GiiispAcademicSearch/1.0 (mailto:contact@giiisp.com)",
        "Accept": "application/json"
    })

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}", "status": e.code}
    except urllib.error.URLError as e:
        return {"error": f"URL Error: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def decode_abstract(inverted_index):
    """将 abstract_inverted_index 解码为可读的摘要文本"""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""

    word_positions = []
    for word, positions in inverted_index.items():
        if isinstance(positions, list):
            for pos in positions:
                word_positions.append((pos, word))

    if not word_positions:
        return ""

    word_positions.sort(key=lambda x: x[0])
    return " ".join(w for _, w in word_positions)


def extract_authors(authorships):
    """从 authorships 中提取作者名字列表"""
    authors = []
    if not authorships:
        return authors
    for a in authorships:
        author_obj = a.get("author", {})
        name = author_obj.get("display_name", "")
        if name:
            authors.append(name)
    return authors


def format_markdown_works(data):
    """将论文搜索结果格式化为 Markdown 表格"""
    lines = []
    meta = data.get("meta", {})
    results = data.get("results", [])

    if meta.get("count"):
        lines.append(f"**找到 {meta['count']} 篇相关论文** (第 {meta.get('page', 1)} 页, 每页 {meta.get('per_page', len(results))} 条)")
        lines.append("")

    if not results:
        lines.append("*未找到结果*")
        return "\n".join(lines)

    lines.append("| 标题 | 作者 | 年份 | 被引 | 开放获取 |")
    lines.append("|------|------|------|------|----------|")

    for work in results:
        title = work.get("title", work.get("display_name", "N/A"))[:60]
        authors = ", ".join(extract_authors(work.get("authorships", []))[:3])
        if len(work.get("authorships", [])) > 3:
            authors += " 等"
        year = work.get("publication_year", "N/A")
        cited = work.get("cited_by_count", 0)
        oa = "是" if work.get("is_oa") else "否"
        lines.append(f"| {title} | {authors} | {year} | {cited} | {oa} |")

    return "\n".join(lines)


def format_markdown_author(data):
    """格式化作者详情为 Markdown"""
    lines = []
    lines.append(f"**{data.get('display_name', 'N/A')}**")
    lines.append(f"- OpenAlex ID: {data.get('id', 'N/A')}")
    lines.append(f"- ORCID: {data.get('orcid', 'N/A')}")
    lines.append(f"- 论文数量: {data.get('works_count', 0)}")
    lines.append(f"- 总被引次数: {data.get('cited_by_count', 0)}")
    inst = data.get("last_known_institution", {})
    if inst:
        lines.append(f"- 最近机构: {inst.get('display_name', 'N/A')}")
    concepts = data.get("x_concepts", [])
    if concepts:
        concept_names = [c.get("display_name", "") for c in concepts[:5] if c.get("display_name")]
        lines.append(f"- 研究领域: {', '.join(concept_names)}")
    return "\n".join(lines)


def format_markdown_concepts(data):
    """格式化概念搜索结果为 Markdown"""
    lines = []
    results = data.get("results", [])
    if not results:
        lines.append("*未找到相关概念*")
        return "\n".join(lines)

    lines.append("| 概念 | 描述 | 论文数量 | 被引次数 |")
    lines.append("|------|------|----------|----------|")
    for c in results:
        name = c.get("display_name", "N/A")
        desc = (c.get("description", "") or "")[:40]
        works = c.get("works_count", 0)
        cited = c.get("cited_by_count", 0)
        lines.append(f"| {name} | {desc} | {works} | {cited} |")
    return "\n".join(lines)


def format_bibtex(work):
    """将单篇论文格式化为 BibTeX"""
    title = work.get("title", work.get("display_name", ""))
    authors = extract_authors(work.get("authorships", []))
    year = work.get("publication_year", "")
    doi = work.get("doi", "")
    venue = work.get("host_venue", {})
    journal = venue.get("display_name", "")
    publisher = venue.get("publisher", "")
    oa_url = work.get("oa_url", "")

    key_parts = [a.split()[-1] if a else "" for a in authors[:2]]
    key = "".join(key_parts) + str(year) if key_parts and year else "unknown"

    lines = [f"@article{{{key},"]
    lines.append(f'  title = {{{title}}},')
    if authors:
        authors_str = " and ".join(authors)
        lines.append(f'  author = {{{authors_str}}},')
    if year:
        lines.append(f'  year = {{{year}}},')
    if journal:
        lines.append(f'  journal = {{{journal}}},')
    if publisher:
        lines.append(f'  publisher = {{{publisher}}},')
    if doi:
        lines.append(f'  doi = {{{doi}}},')
    if oa_url:
        lines.append(f'  url = {{{oa_url}}},')
    lines.append("}")
    return "\n".join(lines)


def format_csv_header():
    return "title,authors,year,venue,cited_by_count,doi,oa_url,openalex_id"


def format_csv_row(work):
    title = work.get("title", work.get("display_name", "")).replace(",", " ")
    authors = "; ".join(extract_authors(work.get("authorships", [])))
    year = str(work.get("publication_year", ""))
    venue = (work.get("host_venue", {}) or {}).get("display_name", "").replace(",", " ")
    cited = str(work.get("cited_by_count", 0))
    doi = work.get("doi", "")
    oa_url = work.get("oa_url", "")
    oid = work.get("id", "")
    return f'"{title}","{authors}",{year},"{venue}",{cited},"{doi}","{oa_url}","{oid}"'


def main():
    parser = argparse.ArgumentParser(description="OpenAlex API 搜索工具")
    parser.add_argument("--action", choices=["search", "work", "authors", "author", "concept"],
                        default="search", help="操作类型: search(搜论文) work(按ID查论文) authors(搜作者) author(按ID查作者) concept(搜概念)")
    parser.add_argument("--query", help="搜索关键词")
    parser.add_argument("--id", help="OpenAlex ID (如 W2741809807 或 A5023888391)")
    parser.add_argument("--per-page", type=int, default=10, help="每页数量, 默认10, 最大200")
    parser.add_argument("--page", type=int, default=1, help="页码, 默认1")
    parser.add_argument("--filter", help="过滤条件, 如 publication_year:2023")
    parser.add_argument("--sort", help="排序, 如 cited_by_count:desc")
    parser.add_argument("--output", choices=["json", "markdown", "bibtex", "csv"], default="json",
                        help="输出格式")
    args = parser.parse_args()

    result = None
    is_list = False

    if args.action == "search":
        if not args.query:
            print(json.dumps({"error": "--query 必填"}, ensure_ascii=False))
            sys.exit(1)
        params = {
            "search": args.query,
            "per-page": min(args.per_page, 200),
            "page": args.page,
        }
        if args.filter:
            params["filter"] = args.filter
        if args.sort:
            params["sort"] = args.sort
        result = api_get("/works", params)
        is_list = True

    elif args.action == "work":
        if not args.id:
            print(json.dumps({"error": "--id 必填"}, ensure_ascii=False))
            sys.exit(1)
        result = api_get(f"/works/{args.id}")
        is_list = False

    elif args.action == "authors":
        if not args.query:
            print(json.dumps({"error": "--query 必填"}, ensure_ascii=False))
            sys.exit(1)
        params = {
            "search": args.query,
            "per-page": min(args.per_page, 200),
            "page": args.page,
        }
        result = api_get("/authors", params)
        is_list = True

    elif args.action == "author":
        if not args.id:
            print(json.dumps({"error": "--id 必填"}, ensure_ascii=False))
            sys.exit(1)
        result = api_get(f"/authors/{args.id}")
        is_list = False

    elif args.action == "concept":
        if not args.query:
            print(json.dumps({"error": "--query 必填"}, ensure_ascii=False))
            sys.exit(1)
        params = {
            "search": args.query,
            "per-page": min(args.per_page, 200),
            "page": args.page,
        }
        result = api_get("/concepts", params)
        is_list = True

    if result and "error" in result:
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    if args.output == "json":
        # 添加解码后的摘要
        if is_list and "results" in result:
            for item in result["results"]:
                if "abstract_inverted_index" in item and item["abstract_inverted_index"]:
                    item["abstract_decoded"] = decode_abstract(item["abstract_inverted_index"])
        elif "abstract_inverted_index" in result and result["abstract_inverted_index"]:
            result["abstract_decoded"] = decode_abstract(result["abstract_inverted_index"])
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.output == "markdown":
        if args.action in ("search", "work"):
            if is_list:
                print(format_markdown_works(result))
            else:
                # 单篇详情
                authors = ", ".join(extract_authors(result.get("authorships", [])))
                abstract = decode_abstract(result.get("abstract_inverted_index"))
                venue = result.get("host_venue", {}) or {}
                print(f"## {result.get('title', result.get('display_name', 'N/A'))}")
                print(f"- **作者**: {authors or 'N/A'}")
                print(f"- **年份**: {result.get('publication_year', 'N/A')}")
                print(f"- **期刊/会议**: {venue.get('display_name', 'N/A')}")
                print(f"- **被引次数**: {result.get('cited_by_count', 0)}")
                print(f"- **开放获取**: {'是' if result.get('is_oa') else '否'}")
                print(f"- **DOI**: {result.get('doi', 'N/A')}")
                print(f"- **OpenAlex ID**: {result.get('id', 'N/A')}")
                if abstract:
                    print(f"- **摘要**: {abstract[:300]}...")
                related = result.get("related_works", [])
                if related:
                    print(f"- **相关论文**: {len(related)} 篇")
        elif args.action in ("authors", "author"):
            if is_list:
                lines = []
                for author in result.get("results", []):
                    lines.append(format_markdown_author(author))
                    lines.append("")
                print("\n".join(lines))
            else:
                print(format_markdown_author(result))
        elif args.action == "concept":
            print(format_markdown_concepts(result))

    elif args.output == "bibtex":
        if is_list and "results" in result:
            for work in result["results"]:
                print(format_bibtex(work))
                print("")
        else:
            print(format_bibtex(result))

    elif args.output == "csv":
        if is_list and "results" in result:
            print(format_csv_header())
            for work in result["results"]:
                print(format_csv_row(work))
        else:
            print(format_csv_header())
            print(format_csv_row(result))


if __name__ == "__main__":
    main()
