#!/usr/bin/env python3
"""
CNKI 来源统计分析
对解析后的搜索结果做期刊/年份/作者分组统计。
"""

import argparse
import json
import sys
from collections import Counter


def analyze_papers(papers, group_by="journal", top_n=20, min_count=1):
    if group_by == "journal":
        values = [p.get("journal", "") for p in papers if p.get("journal")]
    elif group_by == "year":
        values = [str(p.get("year", "")) for p in papers if p.get("year")]
    elif group_by == "author":
        values = []
        for p in papers:
            for a in p.get("authors", []):
                if a:
                    values.append(a)
    elif group_by == "database":
        values = [p.get("database_type", "unknown") for p in papers]
    elif group_by == "institution":
        values = []
        for p in papers:
            for i in p.get("institutions", []):
                if i:
                    values.append(i)
    else:
        values = []

    counter = Counter(values)
    total = len(values)

    results = []
    for item, count in counter.most_common(top_n):
        if count >= min_count:
            pct = round(count / total * 100, 2) if total > 0 else 0
            results.append({
                "name": item,
                "count": count,
                "percentage": pct
            })

    return {
        "group_by": group_by,
        "total_records": len(papers),
        "total_items": total,
        "unique_items": len(counter),
        "statistics": results
    }


def to_markdown(stats):
    lines = [
        f"## 按 {stats['group_by']} 统计（共 {stats['total_records']} 条记录）",
        "",
        "| 排名 | 名称 | 数量 | 占比 |",
        "|------|------|------|------|"
    ]
    for i, item in enumerate(stats["statistics"], 1):
        lines.append(f"| {i} | {item['name']} | {item['count']} | {item['percentage']}% |")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="CNKI 来源统计分析")
    parser.add_argument("--input", required=True, help="解析后的 JSON 文件路径，或使用 - 从 stdin 读取")
    parser.add_argument("--group", choices=["journal", "year", "author", "database", "institution"],
                        default="journal", help="分组维度")
    parser.add_argument("--top", type=int, default=20, help="显示前 N 项")
    parser.add_argument("--min-count", type=int, default=1, help="最小计数阈值")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="输出格式")
    args = parser.parse_args()

    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        try:
            with open(args.input, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(json.dumps({"error": f"读取文件失败: {e}"}, ensure_ascii=False))
            return

    papers = data.get("papers", data) if isinstance(data, dict) else data
    if not isinstance(papers, list):
        print(json.dumps({"error": "输入数据格式错误，期望 papers 数组"}, ensure_ascii=False))
        return

    stats = analyze_papers(papers, args.group, args.top, args.min_count)

    if args.format == "markdown":
        output = to_markdown(stats)
    else:
        output = json.dumps(stats, ensure_ascii=False, indent=2)

    print(output)


if __name__ == "__main__":
    main()
