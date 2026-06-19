#!/usr/bin/env python3
"""
CNKI 检索请求构造器
支持基础检索与高级检索，输出可直接注入 Chrome 的 JS 代码与 curl 命令。
"""

import argparse
import json
import urllib.parse
import urllib.request

CDP_BASE = "http://127.0.0.1:9222"


def get_cdp_target_url():
    """从 CDP 获取当前页面 websocket target URL。"""
    try:
        req = urllib.request.Request(f"{CDP_BASE}/json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            pages = json.loads(resp.read().decode("utf-8"))
        for page in pages:
            if page.get("type") == "page" and "kns.cnki.net" in page.get("url", ""):
                return page.get("webSocketDebuggerUrl", "")
        return ""
    except Exception:
        return ""


def build_basic_search_url(query, year_start=None, year_end=None, source="all"):
    """构造知网基础检索 URL。"""
    base = "https://kns.cnki.net/kns8/defaultresult/index"
    params = {"kw": query, "korder": "SU"}
    filters = []
    if year_start and year_end:
        filters.append(f"publishdate_from={year_start}&publishdate_to={year_end}")
    if source == "journal":
        filters.append("dbcode=CJFQ")
    elif source == "thesis":
        filters.append("dbcode=CMFD")
    elif source == "conference":
        filters.append("dbcode=CPFD")
    url = base + "?" + urllib.parse.urlencode(params)
    if filters:
        url += "&" + "&".join(filters)
    return url


def build_advanced_search_js(title=None, author=None, keyword=None, institution=None,
                              exclude=None, year_start=None, year_end=None,
                              source="all", sort_type="publishdate"):
    """构造高级检索的 JS 注入代码。"""
    conditions = []
    if title:
        conditions.append({"field": "TI", "value": title, "logic": "AND"})
    if author:
        conditions.append({"field": "AU", "value": author, "logic": "AND"})
    if keyword:
        conditions.append({"field": "KY", "value": keyword, "logic": "AND"})
    if institution:
        conditions.append({"field": "AF", "value": institution, "logic": "AND"})
    if exclude:
        conditions.append({"field": "TI", "value": exclude, "logic": "NOT"})

    sort_map = {
        "publishdate": "publishdate",
        "citation": "citedCount",
        "download": "downloadCount",
        "relevance": "relevant"
    }
    sort_field = sort_map.get(sort_type, "publishdate")

    js = """
(function() {
    var conditions = %s;
    var yearStart = %s;
    var yearEnd = %s;
    var source = "%s";
    var sortField = "%s";

    function buildAdvQuery() {
        var queryArr = [];
        for (var i = 0; i < conditions.length; i++) {
            var c = conditions[i];
            queryArr.push(c.field + "=" + encodeURIComponent(c.value));
        }
        return queryArr.join("&");
    }

    var url = "https://kns.cnki.net/kns8/AdvSearch/getGridTableHtml?" + buildAdvQuery();
    if (yearStart && yearEnd) {
        url += "&publishdate_from=" + yearStart + "&publishdate_to=" + yearEnd;
    }
    if (source !== "all") {
        var dbMap = {"journal": "CJFQ", "thesis": "CMFD", "conference": "CPFD"};
        url += "&dbcode=" + dbMap[source];
    }
    url += "&sortField=" + sortField + "&sortType=DESC";
    url += "&pageNum=1&pageSize=20";

    window.location.href = url;
    return {"status": "navigating", "url": url};
})();
""" % (
        json.dumps(conditions, ensure_ascii=False),
        json.dumps(year_start),
        json.dumps(year_end),
        source,
        sort_field
    )
    return js.strip()


def build_cdp_command(js_code, ws_url=None):
    """构造通过 CDP 注入 JS 的 curl 命令。"""
    if not ws_url:
        ws_url = get_cdp_target_url()

    payload = json.dumps({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": js_code,
            "returnByValue": True
        }
    })

    if ws_url:
        cmd = f"echo '{payload}' | websocat '{ws_url}'"
    else:
        cmd = f"# 未检测到知网页面，请先打开知网后再执行\n# 或手动在 Chrome 控制台执行以下 JS:\n{js_code}"

    return cmd


def main():
    parser = argparse.ArgumentParser(description="CNKI 检索请求构造器")
    parser.add_argument("--query", help="基础检索关键词")
    parser.add_argument("--mode", choices=["basic", "advanced"], default="basic",
                        help="检索模式：basic（基础）或 advanced（高级）")
    parser.add_argument("--title", help="高级检索：篇名")
    parser.add_argument("--author", help="高级检索：作者")
    parser.add_argument("--keyword", help="高级检索：关键词")
    parser.add_argument("--institution", help="高级检索：机构")
    parser.add_argument("--exclude", help="排除词（NOT）")
    parser.add_argument("--year-start", type=int, help="起始年份")
    parser.add_argument("--year-end", type=int, help="结束年份")
    parser.add_argument("--source", choices=["all", "journal", "thesis", "conference"],
                        default="all", help="文献来源类型")
    parser.add_argument("--sort", choices=["publishdate", "citation", "download", "relevance"],
                        default="publishdate", help="排序方式")
    parser.add_argument("--output-js", action="store_true", help="仅输出 JS 代码，不构造 curl")
    args = parser.parse_args()

    result = {"mode": args.mode, "commands": []}

    if args.mode == "basic":
        if not args.query:
            print(json.dumps({"error": "基础检索必须提供 --query"}, ensure_ascii=False))
            return
        url = build_basic_search_url(
            args.query, args.year_start, args.year_end, args.source
        )
        js = f'window.location.href = "{url}";'
        result["url"] = url
        result["js"] = js
        result["commands"].append({"type": "browser_open", "url": url})
        result["commands"].append({"type": "cdp_inject", "command": build_cdp_command(js)})
    else:
        if not any([args.title, args.author, args.keyword, args.institution]):
            print(json.dumps({"error": "高级检索至少提供一个字段（--title/--author/--keyword/--institution）"},
                             ensure_ascii=False))
            return
        js = build_advanced_search_js(
            title=args.title,
            author=args.author,
            keyword=args.keyword,
            institution=args.institution,
            exclude=args.exclude,
            year_start=args.year_start,
            year_end=args.year_end,
            source=args.source,
            sort_type=args.sort
        )
        result["js"] = js
        result["commands"].append({"type": "cdp_inject", "command": build_cdp_command(js)})

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
