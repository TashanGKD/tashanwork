import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"


def run_script(*args):
    completed = subprocess.run(
        [sys.executable, *map(str, args)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return completed.stdout


def test_search_pipeline_preserves_original_query_first():
    stdout = run_script(
        ROOT / "scripts" / "search_pipeline.py",
        "--query",
        "diffusion model",
        "--platform",
        "auto",
        "--limit",
        "5",
    )
    payload = json.loads(stdout)
    assert payload["expanded_queries"][0] == "diffusion model"
    assert '"key": "diffusion model"' in payload["commands"][0]


def test_cnki_sample_html_parser_extracts_core_fields():
    stdout = run_script(
        ROOT / "scripts" / "cnki_parse_results.py",
        "--input",
        FIXTURES / "cnki_sample.html",
        "--format",
        "json",
    )
    payload = json.loads(stdout)
    assert payload["count"] == 1
    paper = payload["papers"][0]
    assert paper["title"] == "高校图书馆智慧服务能力建设研究"
    assert paper["authors"] == ["张三", "李四"]
    assert paper["journal"] == "图书馆论坛"
    assert paper["year"] == 2026
    assert paper["citations"] == 12
    assert paper["downloads"] == 345


def test_cross_platform_dedup_merges_normalized_doi_and_preserves_fields(tmp_path):
    output_path = tmp_path / "deduped.json"
    run_script(
        ROOT / "scripts" / "cross_platform_dedup.py",
        "--inputs",
        FIXTURES / "source_a.json",
        FIXTURES / "source_b.json",
        "--output",
        output_path,
        "--similarity-threshold",
        "0.90",
    )
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["stats"]["total_before"] == 3
    assert payload["stats"]["total_after"] == 2
    merged = next(p for p in payload["papers"] if p.get("_dedup_group_size") == 2)
    assert merged["source_platforms"] == ["giiisp", "openalex"]
    assert merged["arxiv_id"] == "2112.10752"
    assert merged["citationCount"] == 13564
