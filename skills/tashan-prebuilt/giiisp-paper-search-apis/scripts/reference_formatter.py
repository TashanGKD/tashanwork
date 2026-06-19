#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
参考文献格式转换脚本
支持 GB/T 7714-2015（顺序编码制/著者-出版年制）、APA 第7版、MLA 第9版、RIS、EndNote
"""

import argparse
import json
import os
import re
import sys


def parse_input(input_str):
    """解析输入：支持文件路径、JSON字符串或标准输入（-）"""
    input_str = input_str.strip()
    # 标准输入
    if input_str == "-":
        data = sys.stdin.read().strip()
        return json.loads(data)
    # 如果是文件路径且存在，读取文件
    if os.path.isfile(input_str):
        with open(input_str, "r", encoding="utf-8") as f:
            return json.load(f)
    # 否则作为JSON字符串解析
    return json.loads(input_str)


def _normalize_author(a):
    """统一处理作者字段，支持字符串或对象格式"""
    if isinstance(a, dict):
        # 优先使用 family_name + given_name 组合
        family = a.get("family_name") or a.get("surname") or ""
        given = a.get("given_name") or a.get("first_name") or ""
        if family and given:
            return f"{family}, {given}"
        # 回退到通用 name 字段
        a = a.get("name") or a.get("author") or a.get("full_name") or a.get("display_name") or ""
    return str(a).strip()


def _is_probably_chinese_name(name):
    """检测名字是否可能是中文（含汉字或短拼音），避免错误反转"""
    if not name:
        return False
    # 包含中文字符 -> 确定为中文
    if re.search(r'[\u4e00-\u9fff]', name):
        return True
    # 纯 ASCII 短名字（2部分，每部分<=6字符）可能是拼音，保守保留原样
    parts = name.split()
    if len(parts) == 2 and all(len(p) <= 6 for p in parts):
        return True
    return False


def format_authors_gbt(authors, max_show=3):
    """GB/T 7714 作者格式：姓在前名在后，超过3人取前3加'等'"""
    if not authors:
        return "佚名"
    formatted = []
    for a in authors:
        a = _normalize_author(a)
        if not a:
            continue
        # 如果已经是 "Last, First" 格式，直接保留
        if re.match(r'^[A-Za-z]', a) and ',' in a:
            formatted.append(a)
        elif re.match(r'^[A-Za-z]', a) and ' ' in a and not _is_probably_chinese_name(a):
            parts = a.split()
            formatted.append(f"{parts[-1]}, {' '.join(parts[:-1])}")
        else:
            # 中文名或拼音名直接保留
            formatted.append(a)
    if len(formatted) > max_show:
        return ", ".join(formatted[:max_show]) + ", 等"
    return ", ".join(formatted)


def format_authors_apa(authors):
    """APA 第7版作者格式：姓, 名首字母."""
    if not authors:
        return "佚名"
    formatted = []
    for a in authors:
        a = _normalize_author(a)
        if not a:
            continue
        if re.match(r'^[A-Za-z]', a) and ',' in a and not _is_probably_chinese_name(a):
            # 已经是 "Last, First" 格式，提取姓和首字母
            last, first = a.split(',', 1)
            last = last.strip()
            initials_parts = first.strip().split()
            initials = ''.join([p[0] + '.' for p in initials_parts if p])
            formatted.append(f"{last}, {initials}")
        elif re.match(r'^[A-Za-z]', a) and ' ' in a and not _is_probably_chinese_name(a):
            parts = a.split()
            last = parts[-1]
            initials = ''.join([p[0] + '.' for p in parts[:-1] if p])
            formatted.append(f"{last}, {initials}")
        else:
            formatted.append(a)
    if len(formatted) == 0:
        return "佚名"
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return " & ".join(formatted)
    return ", ".join(formatted[:-1]) + ", & " + formatted[-1]


def format_authors_mla(authors):
    """MLA 第9版作者格式"""
    if not authors:
        return "佚名"

    def _fmt_one(a):
        a = _normalize_author(a)
        if not a:
            return ""
        if re.match(r'^[A-Za-z]', a) and ',' in a and not _is_probably_chinese_name(a):
            last, first = a.split(',', 1)
            return f"{last.strip()}, {first.strip()}"
        if re.match(r'^[A-Za-z]', a) and ' ' in a and not _is_probably_chinese_name(a):
            parts = a.split()
            return f"{parts[-1]}, {' '.join(parts[:-1])}"
        return a

    first_author = _fmt_one(authors[0])
    if not first_author:
        return "佚名"
    if len(authors) == 1:
        return first_author
    if len(authors) == 2:
        second = _normalize_author(authors[1])
        if re.match(r'^[A-Za-z]', second) and ' ' in second and not _is_probably_chinese_name(second):
            parts = second.split()
            second = f"{' '.join(parts[:-1])} {parts[-1]}"
        return f"{first_author}, and {second}"
    return f"{first_author}, et al."


def format_gbt7714_sequential(papers):
    """GB/T 7714-2015 顺序编码制"""
    results = []
    for i, p in enumerate(papers, 1):
        authors = format_authors_gbt(p.get("authors", []))
        title = p.get("title", "")
        journal = p.get("journal", "")
        year = p.get("year", "")
        volume = p.get("volume", "")
        issue = p.get("issue", "")
        pages = p.get("pages", "")
        doi = p.get("doi", "")

        parts = [authors]
        parts.append(f"{title}[J]")
        parts.append(journal)
        if year:
            parts.append(str(year))
        if volume:
            vol_issue = volume
            if issue:
                vol_issue += f"({issue})"
            parts.append(vol_issue)
        if pages:
            parts.append(f"{pages}.")
        if doi:
            parts.append(f"DOI:{doi}.")

        results.append(f"[{i}] " + ", ".join(parts))
    return "\n".join(results)


def format_gbt7714_author_year(papers):
    """GB/T 7714-2015 著者-出版年制"""
    results = []
    for p in papers:
        authors = format_authors_gbt(p.get("authors", []), max_show=2)
        year = p.get("year", "")
        title = p.get("title", "")
        journal = p.get("journal", "")
        volume = p.get("volume", "")
        issue = p.get("issue", "")
        pages = p.get("pages", "")

        parts = [authors]
        if year:
            parts.append(str(year))
        parts.append(f"{title}[J]")
        parts.append(journal)
        if volume:
            vol_issue = volume
            if issue:
                vol_issue += f"({issue})"
            parts.append(vol_issue)
        if pages:
            parts.append(f"{pages}.")

        results.append(". ".join(parts))
    return "\n".join(results)


def format_apa7(papers):
    """APA 第7版格式"""
    results = []
    for p in papers:
        authors = format_authors_apa(p.get("authors", []))
        year = p.get("year", "")
        title = p.get("title", "")
        journal = p.get("journal", "")
        volume = p.get("volume", "")
        issue = p.get("issue", "")
        pages = p.get("pages", "")
        doi = p.get("doi", "")

        # 标题首字母大写（APA风格）
        title = title[0].upper() + title[1:] if title else ""

        parts = [authors]
        if year:
            parts.append(f"({year})")
        parts.append(title)
        if journal:
            parts.append(journal)
        if volume:
            if issue:
                parts.append(f"{volume}({issue})")
            else:
                parts.append(volume)
        if pages:
            parts.append(f"{pages}.")
        if doi:
            parts.append(f"https://doi.org/{doi}")

        results.append(". ".join(parts))
    return "\n".join(results)


def format_mla9(papers):
    """MLA 第9版格式"""
    results = []
    for p in papers:
        authors = format_authors_mla(p.get("authors", []))
        title = p.get("title", "")
        journal = p.get("journal", "")
        volume = p.get("volume", "")
        issue = p.get("issue", "")
        year = p.get("year", "")
        pages = p.get("pages", "")
        doi = p.get("doi", "")

        parts = [authors]
        parts.append(f'"{title}."')
        if journal:
            parts.append(journal)
        if volume:
            if issue:
                parts.append(f"vol. {volume}, no. {issue}")
            else:
                parts.append(f"vol. {volume}")
        if year:
            parts.append(str(year))
        if pages:
            parts.append(f"pp. {pages}.")
        if doi:
            parts.append(f"doi:{doi}.")

        results.append(", ".join(parts))
    return "\n".join(results)


def format_ris(papers):
    """RIS 格式（用于 Zotero、EndNote、Mendeley 导入）"""
    lines = []
    for p in papers:
        lines.append("TY  - JOUR")
        title = p.get("title", "")
        if title:
            lines.append(f"TI  - {title}")
        authors = p.get("authors", [])
        for a in authors:
            a = _normalize_author(a)
            if a:
                lines.append(f"AU  - {a}")
        journal = p.get("journal", "")
        if journal:
            lines.append(f"JO  - {journal}")
        year = p.get("year", "")
        if year:
            lines.append(f"PY  - {year}")
        volume = p.get("volume", "")
        if volume:
            lines.append(f"VL  - {volume}")
        issue = p.get("issue", "")
        if issue:
            lines.append(f"IS  - {issue}")
        pages = p.get("pages", "")
        if pages:
            lines.append(f"SP  - {pages}")
        doi = p.get("doi", "")
        if doi:
            lines.append(f"DO  - {doi}")
        abstract = p.get("abstract", "")
        if abstract:
            # RIS 每行限制，简单截断
            lines.append(f"AB  - {abstract[:500]}")
        lines.append("ER  - ")
        lines.append("")
    return "\n".join(lines)


def format_endnote(papers):
    """EndNote 格式（.enw）"""
    lines = []
    for p in papers:
        lines.append("%0 Journal Article")
        title = p.get("title", "")
        if title:
            lines.append(f"%T {title}")
        authors = p.get("authors", [])
        for a in authors:
            a = _normalize_author(a)
            if a:
                lines.append(f"%A {a}")
        journal = p.get("journal", "")
        if journal:
            lines.append(f"%J {journal}")
        year = p.get("year", "")
        if year:
            lines.append(f"%D {year}")
        volume = p.get("volume", "")
        if volume:
            lines.append(f"%V {volume}")
        issue = p.get("issue", "")
        if issue:
            lines.append(f"%N {issue}")
        pages = p.get("pages", "")
        if pages:
            lines.append(f"%P {pages}")
        doi = p.get("doi", "")
        if doi:
            lines.append(f"%R {doi}")
        abstract = p.get("abstract", "")
        if abstract:
            lines.append(f"%X {abstract[:500]}")
        url = p.get("url", "")
        if url:
            lines.append(f"%U {url}")
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="参考文献格式转换工具")
    parser.add_argument("--input", required=True, help="输入文件路径或JSON字符串")
    parser.add_argument(
        "--format",
        required=True,
        choices=["gbt7714-seq", "gbt7714-ay", "apa7", "mla9", "ris", "endnote"],
        help="输出格式: gbt7714-seq(顺序编码制), gbt7714-ay(著者-出版年制), apa7, mla9, ris, endnote"
    )
    args = parser.parse_args()

    try:
        papers = parse_input(args.input)
        if not isinstance(papers, list):
            papers = [papers]
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON解析失败: {str(e)}"}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"输入处理失败: {str(e)}"}, ensure_ascii=False))
        sys.exit(1)

    formatters = {
        "gbt7714-seq": format_gbt7714_sequential,
        "gbt7714-ay": format_gbt7714_author_year,
        "apa7": format_apa7,
        "mla9": format_mla9,
        "ris": format_ris,
        "endnote": format_endnote,
    }

    formatter = formatters[args.format]
    formatted = formatter(papers)

    result = {
        "format": args.format,
        "count": len(papers),
        "output": formatted
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
