#!/usr/bin/env python3
"""
CNKI 论文详情页解析器
解析单篇论文详情页 HTML，提取摘要、关键词、基金、DOI、参考文献等完整信息。
"""

import argparse
import json
import re
import sys
import urllib.request


def strip_html(html):
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_detail_page(html):
    """解析知网详情页 HTML。"""
    detail = {}

    # 标题
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
    if title_match:
        detail["title"] = strip_html(title_match.group(1))
    else:
        title_match = re.search(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
        detail["title"] = strip_html(title_match.group(1)) if title_match else ""

    # 作者
    authors = re.findall(r'<a[^>]*class="[^"]*author[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
    if not authors:
        authors = re.findall(r'<span[^>]*class="[^"]*author[^"]*"[^>]*>(.*?)</span>', html, re.DOTALL)
    detail["authors"] = [strip_html(a) for a in authors if strip_html(a)]

    # 机构
    institutions = re.findall(r'<a[^>]*class="[^"]*org[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
    if not institutions:
        institutions = re.findall(r'<span[^>]*class="[^"]*org[^"]*"[^>]*>(.*?)</span>', html, re.DOTALL)
    detail["institutions"] = [strip_html(i) for i in institutions if strip_html(i)]

    # 期刊
    journal_match = re.search(r'<a[^>]*class="[^"]*journal[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
    if not journal_match:
        journal_match = re.search(r'期刊[:：]\s*<a[^>]*>(.*?)</a>', html, re.DOTALL)
    detail["journal"] = strip_html(journal_match.group(1)) if journal_match else ""

    # 年份/卷期/页码
    year_match = re.search(r'(\d{4})\s*年', html)
    detail["year"] = int(year_match.group(1)) if year_match else None

    vol_match = re.search(r'(\d+)\s*卷', html) or re.search(r'Vol\.?\s*(\d+)', html, re.I)
    detail["volume"] = vol_match.group(1) if vol_match else ""

    issue_match = re.search(r'(\d+)\s*期', html) or re.search(r'No\.?\s*(\d+)', html, re.I)
    detail["issue"] = issue_match.group(1) if issue_match else ""

    pages_match = re.search(r'(\d+)[\s\-]*(\d+)\s*页', html) or re.search(r'pp\.?\s*(\d+)[\s\-]+(\d+)', html, re.I)
    if pages_match:
        detail["pages"] = f"{pages_match.group(1)}-{pages_match.group(2)}"
    else:
        detail["pages"] = ""

    # DOI
    doi_match = re.search(r'DOI[:：]?\s*([\w./\-]+)', html, re.I)
    detail["doi"] = doi_match.group(1).strip() if doi_match else ""

    # 摘要
    abstract_match = re.search(r'摘要[:：]?\s*</span>\s*</h\w+>\s*<p[^>]*>(.*?)</p>', html, re.DOTALL)
    if not abstract_match:
        abstract_match = re.search(r'class="[^"]*abstract[^"]*"[^>]*>(.*?)</', html, re.DOTALL)
    if not abstract_match:
        abstract_match = re.search(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
    detail["abstract"] = strip_html(abstract_match.group(1)) if abstract_match else ""

    # 关键词
    keywords = re.findall(r'<a[^>]*class="[^"]*keyword[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
    if not keywords:
        kw_section = re.search(r'关键词[:：]?\s*(.*?)(?:</p>|</div>|</li>)', html, re.DOTALL)
        if kw_section:
            keywords = re.findall(r'<a[^>]*>(.*?)</a>', kw_section.group(1), re.DOTALL)
    detail["keywords"] = [strip_html(k) for k in keywords if strip_html(k)]

    # 基金
    fund_match = re.search(r'基金[:：]?\s*(.*?)(?:</p>|</div>|</li>)', html, re.DOTALL)
    if fund_match:
        detail["funding"] = strip_html(fund_match.group(1))
    else:
        detail["funding"] = ""

    # 分类号
    clc_match = re.search(r'中图分类号[:：]?\s*([\w.\-/]+)', html)
    detail["clc"] = clc_match.group(1).strip() if clc_match else ""

    # 被引/下载
    cited_match = re.search(r'被引[:：]?\s*(\d+)', html)
    detail["citations"] = int(cited_match.group(1)) if cited_match else 0

    download_match = re.search(r'下载[:：]?\s*(\d+)', html)
    detail["downloads"] = int(download_match.group(1)) if download_match else 0

    return detail


def fetch_and_parse(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        return parse_detail_page(html)
    except Exception as e:
        return {"error": str(e), "url": url}


def main():
    parser = argparse.ArgumentParser(description="CNKI 论文详情页解析器")
    parser.add_argument("--input", required=True, help="详情页 HTML 文件路径，或详情页 URL，或使用 - 从 stdin 读取")
    args = parser.parse_args()

    if args.input.startswith("http"):
        detail = fetch_and_parse(args.input)
    elif args.input == "-":
        html = sys.stdin.read()
        detail = parse_detail_page(html)
    else:
        try:
            with open(args.input, "r", encoding="utf-8") as f:
                html = f.read()
            detail = parse_detail_page(html)
        except Exception as e:
            detail = {"error": f"读取文件失败: {e}"}

    print(json.dumps(detail, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
