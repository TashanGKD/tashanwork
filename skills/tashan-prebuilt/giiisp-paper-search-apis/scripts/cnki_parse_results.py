#!/usr/bin/env python3
"""
CNKI 搜索结果解析器
解析搜索结果页 HTML，提取标题、作者、期刊、年份、被引量、下载量等结构化字段。
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser


class TextExtractor(HTMLParser):
    """简易 HTML 文本提取器，用于清理 HTML 标签。"""
    def __init__(self):
        super().__init__()
        self.texts = []
        self.skip_tags = {"script", "style", "noscript"}
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self._skip -= 1

    def handle_data(self, data):
        if self._skip <= 0:
            self.texts.append(data)

    def get_text(self):
        return " ".join(self.texts)


def strip_html(html):
    extractor = TextExtractor()
    try:
        extractor.feed(html)
        return extractor.get_text()
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)


def parse_cnki_results(html):
    """解析知网搜索结果 HTML，返回论文列表。"""
    papers = []

    # 知网 8.0 搜索结果条目通常以 class 包含 result-table-list 或类似结构
    # 采用多模式匹配策略，适配不同版本的 DOM 结构
    patterns = [
        # 模式1：新版 kns8 表格行
        r'<tr[^>]*>.*?<td[^>]*>.*?</td>.*?</tr>',
        # 模式2：结果列表项
        r'<div[^>]*class="[^"]*result[^"]*"[^>]*>.*?</div>\s*</div>',
        # 模式3：文章条目
        r'<div[^>]*class="[^"]*article[^"]*"[^>]*>.*?</div>\s*</div>',
    ]

    # 先尝试按行解析表格结构
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)

    for row in rows:
        paper = {}
        # 标题：通常包含链接和 class="title" 或 <a> 标签
        title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', row, re.DOTALL)
        if title_match:
            paper["title"] = strip_html(title_match.group(2)).strip()
            paper["detail_url"] = title_match.group(1)
            if paper["detail_url"].startswith("/"):
                paper["detail_url"] = "https://kns.cnki.net" + paper["detail_url"]
        else:
            continue

        # 作者
        authors_match = re.findall(r'<a[^>]*class="[^"]*author[^"]*"[^>]*>(.*?)</a>', row, re.DOTALL)
        if not authors_match:
            authors_match = re.findall(r'<td[^>]*>\s*<a[^>]*>([^<]+)</a>', row)
        paper["authors"] = [strip_html(a).strip() for a in authors_match if strip_html(a).strip()]

        # 期刊/来源
        source_match = re.search(r'<a[^>]*class="[^"]*source[^"]*"[^>]*>(.*?)</a>', row, re.DOTALL)
        if not source_match:
            source_match = re.search(r'<span[^>]*class="[^"]*source[^"]*"[^>]*>(.*?)</span>', row, re.DOTALL)
        if source_match:
            paper["journal"] = strip_html(source_match.group(1)).strip()
        else:
            paper["journal"] = ""

        # 年份
        year_match = re.search(r'(\d{4})\s*年?', row)
        if year_match:
            paper["year"] = int(year_match.group(1))
        else:
            paper["year"] = None

        # 被引量
        cited_match = re.search(r'被引[:：]\s*(\d+)', row) or re.search(r'(\d+)\s*次引用', row)
        if cited_match:
            paper["citations"] = int(cited_match.group(1))
        else:
            paper["citations"] = 0

        # 下载量
        download_match = re.search(r'下载[:：]\s*(\d+)', row) or re.search(r'(\d+)\s*次下载', row)
        if download_match:
            paper["downloads"] = int(download_match.group(1))
        else:
            paper["downloads"] = 0

        # 数据库类型
        if "CJFQ" in row or "期刊" in row:
            paper["database_type"] = "journal"
        elif "CMFD" in row or "硕士" in row or "博士" in row:
            paper["database_type"] = "thesis"
        elif "CPFD" in row or "会议" in row:
            paper["database_type"] = "conference"
        else:
            paper["database_type"] = "unknown"

        # 在线发表状态
        paper["is_online_first"] = "网络首发" in row or "online" in row.lower()

        # 摘要（列表页通常只有前几句）
        abstract_match = re.search(r'<p[^>]*class="[^"]*abstract[^"]*"[^>]*>(.*?)</p>', row, re.DOTALL)
        if abstract_match:
            paper["abstract_snippet"] = strip_html(abstract_match.group(1)).strip()[:200]
        else:
            paper["abstract_snippet"] = ""

        if paper.get("title"):
            papers.append(paper)

    # 如果表格行解析未命中，尝试 div 结果列表模式
    if not papers:
        div_items = re.findall(r'<div[^>]*class="[^"]*result[^"]*list[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
        for item in div_items:
            paper = {}
            title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', item, re.DOTALL)
            if title_match:
                paper["title"] = strip_html(title_match.group(2)).strip()
                paper["detail_url"] = title_match.group(1)
            authors = re.findall(r'author[^"]*"[^>]*>([^<]+)', item)
            paper["authors"] = [a.strip() for a in authors]
            year_match = re.search(r'(\d{4})', item)
            paper["year"] = int(year_match.group(1)) if year_match else None
            paper["citations"] = 0
            paper["downloads"] = 0
            paper["database_type"] = "unknown"
            paper["is_online_first"] = False
            paper["abstract_snippet"] = ""
            if paper.get("title"):
                papers.append(paper)

    return papers


def to_csv(papers):
    lines = ["标题,作者,期刊,年份,被引量,下载量,数据库类型,在线首发,详情链接"]
    for p in papers:
        authors = ";".join(p.get("authors", []))
        line = f'"{p.get("title", "")}","{authors}","{p.get("journal", "")}",{p.get("year", "")},{p.get("citations", 0)},{p.get("downloads", 0)},{p.get("database_type", "")},{p.get("is_online_first", False)},{p.get("detail_url", "")}'
        lines.append(line)
    return "\n".join(lines)


def to_markdown(papers):
    lines = ["| 序号 | 标题 | 作者 | 期刊 | 年份 | 被引 | 下载 | 类型 |", "|------|------|------|------|------|------|------|------|"]
    for i, p in enumerate(papers, 1):
        authors = ", ".join(p.get("authors", [])[:3])
        if len(p.get("authors", [])) > 3:
            authors += " 等"
        lines.append(f"| {i} | {p.get('title', '')} | {authors} | {p.get('journal', '')} | {p.get('year', '')} | {p.get('citations', 0)} | {p.get('downloads', 0)} | {p.get('database_type', '')} |")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="CNKI 搜索结果解析器")
    parser.add_argument("--input", required=True, help="搜索结果 HTML 文件路径，或使用 - 从 stdin 读取")
    parser.add_argument("--format", choices=["json", "csv", "markdown"], default="json", help="输出格式")
    args = parser.parse_args()

    if args.input == "-":
        html = sys.stdin.read()
    else:
        try:
            with open(args.input, "r", encoding="utf-8") as f:
                html = f.read()
        except Exception as e:
            print(json.dumps({"error": f"读取文件失败: {e}"}, ensure_ascii=False))
            return

    papers = parse_cnki_results(html)

    if args.format == "json":
        output = json.dumps({"count": len(papers), "papers": papers}, ensure_ascii=False, indent=2)
    elif args.format == "csv":
        output = to_csv(papers)
    elif args.format == "markdown":
        output = to_markdown(papers)
    else:
        output = json.dumps(papers, ensure_ascii=False, indent=2)

    print(output)


if __name__ == "__main__":
    main()
