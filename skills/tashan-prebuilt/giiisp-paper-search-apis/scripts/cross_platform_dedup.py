#!/usr/bin/env python3
"""
cross_platform_dedup.py
跨平台去重：合并 Giiisp / Lewen / CNKI / 其他平台检索结果，
基于统一元数据 Schema 识别并合并同一篇论文的多平台记录。

用法:
  python scripts/cross_platform_dedup.py \
    --inputs giiisp_results.json lewen_results.json cnki_results.json \
    --output deduped.json \
    [--similarity-threshold 0.90]
"""

import argparse
import json
import sys
import re


def load_results(filepath):
    """加载单个平台的结果文件（JSON 数组或 JSONL）"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()
        if content.startswith("["):
            return json.loads(content)
        results = []
        for line in content.splitlines():
            line = line.strip()
            if line:
                results.append(json.loads(line))
        return results


def extract_id_keys(paper):
    """提取去重标识键，按优先级排序"""
    ids = {}
    ext = paper.get("externalIds", {})
    arxiv_id = paper.get("arxiv_id") or paper.get("arxivNo") or paper.get("arvixNo") or ext.get("ArXiv")
    doi = paper.get("doi") or ext.get("DOI")
    if isinstance(arxiv_id, str):
        arxiv_id = arxiv_id.strip().replace("arXiv:", "").replace("arxiv:", "").lower()
    if isinstance(doi, str):
        doi = doi.strip().lower()
        doi = doi.replace("https://doi.org/", "").replace("http://doi.org/", "").replace("doi:", "")
    ids["arxiv_id"] = arxiv_id
    ids["doi"] = doi
    ids["corpus_id"] = paper.get("corpusId") or paper.get("paperId")
    ids["cnki_id"] = paper.get("dbcode") or paper.get("filename")
    ids["title"] = paper.get("title", "").strip().lower()
    ids["authors_key"] = tuple(sorted(
        a.get("name", a) if isinstance(a, dict) else a
        for a in paper.get("authors", [])
    ))
    ids["year"] = paper.get("year")
    return ids


def normalize_title(title):
    """标题标准化：去标点、去空格、转小写"""
    if not title:
        return ""
    t = title.lower().strip()
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", "", t)
    return t


def title_similarity(t1, t2):
    """计算两个标题的相似度（简单字符级）"""
    n1, n2 = normalize_title(t1), normalize_title(t2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0
    # 最长公共子串比例
    m, n = len(n1), len(n2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    max_len = 0
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if n1[i - 1] == n2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
                max_len = max(max_len, dp[i][j])
    return max_len / max(m, n)


def dedup(results_list, similarity_threshold=0.90):
    """
    跨平台去重主逻辑
    匹配优先级：doi > arxiv_id > corpus_id > cnki_id > title_similarity + authors + year
    """
    all_papers = []
    for source_idx, results in enumerate(results_list):
        for p in results:
            p["_source_index"] = source_idx
            all_papers.append(p)

    # 第一轮：精确 ID 匹配
    id_groups = {}  # id_value -> [papers]
    for p in all_papers:
        ids = extract_id_keys(p)
        matched = False
        for key in ["doi", "arxiv_id", "corpus_id", "cnki_id"]:
            val = ids.get(key)
            if val:
                gid = f"{key}:{val}"
                if gid not in id_groups:
                    id_groups[gid] = []
                id_groups[gid].append(p)
                matched = True
                break
        if not matched:
            gid = f"title:{ids['title']}"
            if gid not in id_groups:
                id_groups[gid] = []
            id_groups[gid].append(p)

    # 第二轮：标题相似度合并（对无精确 ID 的组）
    merged_groups = []
    processed = set()

    for gid, papers in id_groups.items():
        if gid.startswith("title:") and len(papers) > 1:
            # 需要进一步按标题相似度细分
            subgroups = []
            for p in papers:
                placed = False
                for sg in subgroups:
                    ref_title = extract_id_keys(sg[0])["title"]
                    cur_title = extract_id_keys(p)["title"]
                    if title_similarity(ref_title, cur_title) >= similarity_threshold:
                        sg.append(p)
                        placed = True
                        break
                if not placed:
                    subgroups.append([p])
            merged_groups.extend(subgroups)
        else:
            merged_groups.append(papers)

    # 合并每组为统一记录
    unified = []
    for group in merged_groups:
        if not group:
            continue
        base = group[0].copy()
        sources = set()
        all_fields = {}

        for p in group:
            sources.add(p.get("_source_platform", f"source_{p.get('_source_index', 0)}"))
            for k, v in p.items():
                if k.startswith("_"):
                    continue
                if k not in all_fields or not all_fields[k]:
                    all_fields[k] = v
                elif k in ["citationCount", "influentialCitationCount"]:
                    # 取最大值
                    try:
                        all_fields[k] = max(all_fields[k] or 0, v or 0)
                    except Exception:
                        pass

        # 优先使用最完整的记录
        best = max(group, key=lambda x: sum(1 for v in x.values() if v))
        unified_record = {k: v for k, v in best.items() if not k.startswith("_")}
        for k, v in all_fields.items():
            if not k.startswith("_") and (k not in unified_record or unified_record.get(k) in (None, "", [])):
                unified_record[k] = v
        unified_record["source_platforms"] = sorted(sources)
        unified_record["_dedup_group_size"] = len(group)
        unified.append(unified_record)

    return unified


def main():
    parser = argparse.ArgumentParser(description="Cross-platform paper deduplication")
    parser.add_argument("--inputs", nargs="+", required=True, help="Input JSON/JSONL files")
    parser.add_argument("--output", required=True, help="Output unified JSON file")
    parser.add_argument("--similarity-threshold", type=float, default=0.90, help="Title similarity threshold (default 0.90)")
    args = parser.parse_args()

    results_list = []
    for filepath in args.inputs:
        try:
            results = load_results(filepath)
            results_list.append(results)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Failed to load {filepath}: {e}"}, ensure_ascii=False))
            sys.exit(1)

    unified = dedup(results_list, similarity_threshold=args.similarity_threshold)

    total_before = sum(len(r) for r in results_list)
    total_after = len(unified)
    duplicates = total_before - total_after

    output = {
        "status": "success",
        "stats": {
            "total_before": total_before,
            "total_after": total_after,
            "duplicates_removed": duplicates,
            "dedup_rate": round(duplicates / total_before, 4) if total_before > 0 else 0,
        },
        "papers": unified,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(json.dumps({"status": "success", "output_file": args.output, "stats": output["stats"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
