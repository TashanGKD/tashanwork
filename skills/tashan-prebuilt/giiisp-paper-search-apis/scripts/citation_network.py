#!/usr/bin/env python3
"""
citation_network.py
引用网络分析：基于 Lewen API citations/references 数据，
分析论文的引用关系网络，识别核心文献与关键节点。

用法:
  python scripts/citation_network.py \
    --input citations.json \
    --action analyze \
    --top-k 10 \
    [--output-format json]

  python scripts/citation_network.py \
    --input citations.json \
    --action graph \
    --output graph.dot
"""

import argparse
import json
import sys
from collections import defaultdict


def load_graph(input_path):
    """加载引用图数据（Lewen citations/references 格式）"""
    with open(input_path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_graph(papers):
    """
    构建有向图：paper_id -> [cited_paper_ids]
    papers 格式: [{"paperId": "...", "title": "...", "authors": [...], "citationCount": N, ...}]
    """
    nodes = {}
    edges = defaultdict(list)

    for p in papers:
        pid = p.get("paperId") or p.get("id") or p.get("arxiv_id")
        if not pid:
            continue
        nodes[pid] = {
            "title": p.get("title", ""),
            "authors": p.get("authors", []),
            "year": p.get("year"),
            "venue": p.get("venue", ""),
            "citationCount": p.get("citationCount", 0),
        }

    # 如果有明确的引用关系字段
    for p in papers:
        pid = p.get("paperId") or p.get("id") or p.get("arxiv_id")
        refs = p.get("references", [])
        for ref in refs:
            ref_id = ref.get("paperId") or ref.get("id")
            if ref_id and ref_id in nodes:
                edges[pid].append(ref_id)

    return nodes, edges


def compute_degree_centrality(nodes, edges):
    """度中心性：出度（引用别人）+ 入度（被别人引用）"""
    in_degree = defaultdict(int)
    out_degree = defaultdict(int)

    for src, targets in edges.items():
        out_degree[src] = len(targets)
        for t in targets:
            in_degree[t] += 1

    centrality = {}
    for pid in nodes:
        centrality[pid] = {
            "in_degree": in_degree.get(pid, 0),
            "out_degree": out_degree.get(pid, 0),
            "total_degree": in_degree.get(pid, 0) + out_degree.get(pid, 0),
        }
    return centrality


def compute_betweenness_centrality(nodes, edges, top_k=50):
    """
    近似中介中心性（简化版：基于最短路径计数）
    对大图使用采样近似
    """
    all_nodes = list(nodes.keys())
    if len(all_nodes) > top_k * 2:
        # 按 citationCount 采样高影响力节点
        all_nodes = sorted(all_nodes, key=lambda x: nodes[x].get("citationCount", 0), reverse=True)[:top_k * 2]

    betweenness = defaultdict(float)

    # BFS 计算所有点对最短路径
    for source in all_nodes[:min(20, len(all_nodes))]:  # 采样 20 个源点
        distances = {n: float('inf') for n in all_nodes}
        distances[source] = 0
        parents = defaultdict(list)
        queue = [source]
        visited = {source}

        # BFS
        for node in queue:
            for target in edges.get(node, []):
                if target not in visited and target in all_nodes:
                    visited.add(target)
                    queue.append(target)
                    distances[target] = distances[node] + 1
                    parents[target].append(node)
                elif target in all_nodes and distances[target] == distances[node] + 1:
                    parents[target].append(node)

        # 回溯计数（简化）
        node_counts = defaultdict(float)
        for node in all_nodes:
            if distances[node] < float('inf'):
                node_counts[node] += 1.0

        for node in all_nodes:
            if node != source and node_counts[node] > 0:
                betweenness[node] += node_counts[node]

    # 归一化
    max_val = max(betweenness.values()) if betweenness else 1
    for pid in betweenness:
        betweenness[pid] = round(betweenness[pid] / max_val, 4)

    return dict(betweenness)


def identify_core_papers(nodes, edges, top_k=10):
    """识别领域核心文献（综合 citationCount + 度中心性 + 中介中心性）"""
    centrality = compute_degree_centrality(nodes, edges)
    betweenness = compute_betweenness_centrality(nodes, edges, top_k=top_k * 3)

    scores = {}
    for pid in nodes:
        cc = nodes[pid].get("citationCount", 0)
        deg = centrality.get(pid, {}).get("total_degree", 0)
        bet = betweenness.get(pid, 0)
        # 综合评分
        scores[pid] = {
            "citationCount": cc,
            "degree_score": deg,
            "betweenness_score": bet,
            "composite_score": round(cc * 0.5 + deg * 10 + bet * 100, 2),
        }

    sorted_papers = sorted(scores.items(), key=lambda x: x[1]["composite_score"], reverse=True)

    core = []
    for pid, s in sorted_papers[:top_k]:
        core.append({
            "paperId": pid,
            "title": nodes[pid].get("title", ""),
            "year": nodes[pid].get("year"),
            "venue": nodes[pid].get("venue", ""),
            **s,
        })

    return core


def generate_graphviz(nodes, edges, output_path):
    """生成 Graphviz DOT 格式图"""
    lines = ["digraph CitationNetwork {"]
    lines.append("  rankdir=TB;")
    lines.append("  node [shape=box, fontname=\"Helvetica\"];")
    lines.append("")

    # 节点
    for pid, info in nodes.items():
        title = info.get("title", pid)[:30].replace('"', '\\"')
        label = f"{title}\\n({info.get('year', '?')})"
        lines.append(f'  "{pid}" [label="{label}"];')

    lines.append("")

    # 边
    for src, targets in edges.items():
        for t in targets:
            lines.append(f'  "{src}" -> "{t}";')

    lines.append("}")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Citation network analysis")
    parser.add_argument("--input", required=True, help="Input citation graph JSON")
    parser.add_argument("--action", choices=["analyze", "graph", "stats"], required=True)
    parser.add_argument("--top-k", type=int, default=10, help="Top K core papers")
    parser.add_argument("--output", help="Output file (for graph action)")
    parser.add_argument("--output-format", choices=["json", "markdown"], default="json")
    args = parser.parse_args()

    data = load_graph(args.input)
    papers = data if isinstance(data, list) else data.get("papers", [])
    nodes, edges = build_graph(papers)

    if args.action == "stats":
        stats = {
            "total_papers": len(nodes),
            "total_citations": sum(len(t) for t in edges.values()),
            "avg_out_degree": round(sum(len(t) for t in edges.values()) / max(len(nodes), 1), 2),
        }
        print(json.dumps({"status": "success", "stats": stats}, ensure_ascii=False))

    elif args.action == "analyze":
        core = identify_core_papers(nodes, edges, top_k=args.top_k)
        centrality = compute_degree_centrality(nodes, edges)
        betweenness = compute_betweenness_centrality(nodes, edges, top_k=args.top_k * 3)

        result = {
            "status": "success",
            "network_stats": {
                "total_papers": len(nodes),
                "total_citations": sum(len(t) for t in edges.values()),
            },
            "core_papers": core,
            "centrality_summary": {
                "max_in_degree": max((c["in_degree"] for c in centrality.values()), default=0),
                "max_out_degree": max((c["out_degree"] for c in centrality.values()), default=0),
            },
        }

        if args.output_format == "markdown":
            lines = ["# 引用网络分析结果\n", f"**总论文数**: {len(nodes)}\n", f"**总引用关系**: {sum(len(t) for t in edges.values())}\n", "\n## 核心文献 Top {}\n".format(args.top_k)]
            lines.append("| 排名 | 标题 | 年份 | 被引量 | 综合评分 |\n|------|------|------|--------|----------|")
            for i, p in enumerate(core, 1):
                lines.append(f"| {i} | {p['title'][:50]}... | {p.get('year', '?')} | {p['citationCount']} | {p['composite_score']} |")
            output_text = "\n".join(lines)
            print(output_text)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    f.write(output_text)
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

    elif args.action == "graph":
        if not args.output:
            print(json.dumps({"status": "error", "message": "--output required for graph action"}, ensure_ascii=False))
            sys.exit(1)
        path = generate_graphviz(nodes, edges, args.output)
        print(json.dumps({"status": "success", "graph_file": path, "nodes": len(nodes), "edges": sum(len(t) for t in edges.values())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
