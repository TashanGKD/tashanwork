#!/usr/bin/env python3
"""一键检索流水线：输入自然语言查询，输出可直接执行的完整检索方案。"""

import argparse
import json
import hashlib
import sys
from datetime import date


def expand_query(query: str):
    """内置轻量同义词扩展，减少外部依赖。"""
    expansions = {
        "人工智能": ["人工智能", "生成式AI", "大语言模型", "LLM", "深度学习"],
        "大模型": ["大语言模型", "LLM", "Foundation Model", "GPT", "Transformer"],
        "diffusion model": ["diffusion model", "diffusion models", "score-based generative model"],
        "高校图书馆": ["高校图书馆", "大学图书馆", " academic library"],
        "知识图谱": ["knowledge graph", "knowledge graphs", "知识图谱"],
        "推荐系统": ["recommendation system", "recommender system", "协同过滤", "推荐系统"],
        "图神经网络": ["graph neural network", "GNN", "graph convolutional network"],
        "联邦学习": ["federated learning", "联邦学习", "distributed learning"],
        "区块链": ["blockchain", "distributed ledger", "智能合约"],
        "数字孪生": ["digital twin", "digital twins", "数字孪生"],
    }
    for k, v in expansions.items():
        if k.lower() in query.lower():
            seen = set()
            result = []
            for term in [query] + v:
                normalized = term.lower().strip()
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    result.append(term)
            return result
    return [query]


def classify_platform(query: str, hint: str = ""):
    """根据查询内容自动推断最优平台。"""
    q = query.lower()
    h = hint.lower()

    if "arxiv" in h or "arxiv" in q:
        return "giiisp"
    if "oa" in h or "磁盘阵列" in h or "oa paper" in q:
        return "giiisp_oa"
    if "cnki" in h or "知网" in h or "万方" in h or "维普" in h or "中文" in q:
        return "cnki"

    # 默认推断
    if any(k in q for k in ["高校", "知网", "cssci", "北大核心", "中文"]):
        return "cnki"
    # 默认英文 -> Giiisp
    return "giiisp"


def build_curl(platform: str, query: str, limit: int, year_start: int, year_end: int):
    """构造可直接执行的 curl 命令。"""
    cmds = []
    if platform == "giiisp":
        body = json.dumps(
            {
                "key": query,
                "pageNum": 1,
                "pageSize": limit,
            },
            ensure_ascii=False,
        )
        cmds.append(
            f"curl -s -X POST 'https://giiisp.com/first/paper/searchArxiv' "
            f"-H 'Content-Type: application/json' "
            f"-d '{body}' | python -m json.tool"
        )

    elif platform == "giiisp_oa":
        body = json.dumps(
            {
                "titleAndAbs": [query],
            },
            ensure_ascii=False,
        )
        cmds.append(
            f"curl -s -X POST 'https://giiisp.com/first/oaPaper/searchArticlesByQuery1' "
            f"-H 'Content-Type: application/json' "
            f"-d '{body}' | python -m json.tool"
        )

    elif platform == "cnki":
        cmds.append(
            f"python scripts/cnki_search.py --query '{query}' "
            f"--mode basic --year-start {year_start} --year-end {year_end} --source journal"
        )
        cmds.append(
            "# 将上一步输出的 curl 命令在终端执行后，把 HTML 保存为 page1.html，然后："
        )
        cmds.append(
            f"python scripts/cnki_parse_results.py --input page1.html --format json"
        )

    return cmds


def generate_hash(query: str, platform: str):
    return hashlib.md5(f"{query}:{platform}".encode()).hexdigest()[:12]


def main():
    parser = argparse.ArgumentParser(description="一键检索流水线")
    parser.add_argument("--query", required=True, help="检索关键词/自然语言描述")
    parser.add_argument("--platform", default="auto", choices=["auto", "giiisp", "giiisp_oa", "cnki"])
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--year-start", type=int, default=0)
    parser.add_argument("--year-end", type=int, default=0)
    parser.add_argument("--output", default="json", choices=["json", "shell"])
    args = parser.parse_args()

    # 默认近 5 年
    if args.year_start == 0 and args.year_end == 0:
        args.year_end = date.today().year
        args.year_start = args.year_end - 5

    # 平台推断
    platform = args.platform if args.platform != "auto" else classify_platform(args.query)

    # 查询扩展
    expanded = expand_query(args.query)

    # 构造命令
    cmds = build_curl(platform, expanded[0], args.limit, args.year_start, args.year_end)

    # 缓存键
    cache_key = generate_hash(args.query, platform)

    result = {
        "query": args.query,
        "platform": platform,
        "expanded_queries": expanded,
        "cache_key": cache_key,
        "limit": args.limit,
        "year_range": [args.year_start, args.year_end] if args.year_start > 0 else None,
        "commands": cmds,
        "next_steps": [
            "1. 直接复制上面的 curl 命令到终端执行",
            "2. 如需翻页，调用对应 paginate 脚本生成下一页命令",
            "3. 如需结果标准化，按 SKILL.md 的 normalized_results 字段表整理原始响应",
        ],
    }

    if args.output == "shell":
        print("#!/bin/bash")
        print(f"# Pipeline ID: {cache_key}")
        print(f"# Query: {args.query} -> Platform: {platform}")
        for c in cmds:
            print(c)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
