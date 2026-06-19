#!/usr/bin/env python3
"""
CNKI 翻页导航脚本
生成下一页、上一页、指定页、排序切换的 CDP 注入命令。
"""

import argparse
import json
import urllib.request

CDP_BASE = "http://127.0.0.1:9222"


def get_cdp_target_url():
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


def build_paginate_js(action, current_page=1, target_page=1, sort_type="publishdate"):
    sort_map = {
        "publishdate": "publishdate",
        "citation": "citedCount",
        "download": "downloadCount",
        "relevance": "relevant"
    }
    sort_field = sort_map.get(sort_type, "publishdate")

    if action == "next":
        next_page = current_page + 1
        js = f"""
(function() {{
    var nextBtn = document.querySelector('.next-page, .pager-next, a[title="下一页"], a:contains("下一页")');
    if (nextBtn) {{
        nextBtn.click();
        return {{"status": "clicked_next", "from_page": {current_page}, "to_page": {next_page}}};
    }}
    var url = new URL(window.location.href);
    url.searchParams.set('pageNum', '{next_page}');
    window.location.href = url.toString();
    return {{"status": "navigating", "from_page": {current_page}, "to_page": {next_page}}};
}})();
"""
    elif action == "previous":
        prev_page = max(1, current_page - 1)
        js = f"""
(function() {{
    var prevBtn = document.querySelector('.prev-page, .pager-prev, a[title="上一页"], a:contains("上一页")');
    if (prevBtn) {{
        prevBtn.click();
        return {{"status": "clicked_previous", "from_page": {current_page}, "to_page": {prev_page}}};
    }}
    var url = new URL(window.location.href);
    url.searchParams.set('pageNum', '{prev_page}');
    window.location.href = url.toString();
    return {{"status": "navigating", "from_page": {current_page}, "to_page": {prev_page}}};
}})();
"""
    elif action == "page":
        js = f"""
(function() {{
    var url = new URL(window.location.href);
    url.searchParams.set('pageNum', '{target_page}');
    window.location.href = url.toString();
    return {{"status": "navigating", "to_page": {target_page}}};
}})();
"""
    elif action == "sort":
        js = f"""
(function() {{
    var url = new URL(window.location.href);
    url.searchParams.set('sortField', '{sort_field}');
    url.searchParams.set('sortType', 'DESC');
    url.searchParams.set('pageNum', '1');
    window.location.href = url.toString();
    return {{"status": "sorting", "sort_field": "{sort_field}", "sort_type": "DESC"}};
}})();
"""
    else:
        js = "(function() { return {\"error\": \"unknown_action\"}; })();"
    return js.strip()


def build_cdp_command(js_code, ws_url=None):
    if not ws_url:
        ws_url = get_cdp_target_url()
    payload = json.dumps({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {"expression": js_code, "returnByValue": True}
    })
    if ws_url:
        cmd = f"echo '{payload}' | websocat '{ws_url}'"
    else:
        cmd = f"# 请先在 Chrome 控制台执行:\n{js_code}"
    return cmd


def main():
    parser = argparse.ArgumentParser(description="CNKI 翻页导航")
    parser.add_argument("--action", choices=["next", "previous", "page", "sort"],
                        required=True, help="翻页动作")
    parser.add_argument("--current-page", type=int, default=1, help="当前页码")
    parser.add_argument("--target-page", type=int, default=1, help="目标页码（仅 page 动作需要）")
    parser.add_argument("--sort-type", choices=["publishdate", "citation", "download", "relevance"],
                        default="publishdate", help="排序字段（仅 sort 动作需要）")
    args = parser.parse_args()

    js = build_paginate_js(args.action, args.current_page, args.target_page, args.sort_type)
    cmd = build_cdp_command(js)

    result = {
        "action": args.action,
        "js": js,
        "cdp_command": cmd,
        "note": "执行后等待页面加载完成，再保存 HTML 供解析脚本处理"
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
