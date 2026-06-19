#!/usr/bin/env python3
"""
keyword_alert.py
关键词订阅与定时推送：管理订阅列表，检测新增论文并生成推送摘要。

cron 定时执行示例（每日 8:00）：
  0 8 * * * cd /path/to/project && python scripts/keyword_alert.py --action check-all

用法:
  python scripts/keyword_alert.py --action add --keyword "diffusion model" --platform lewen
  python scripts/keyword_alert.py --action list
  python scripts/keyword_alert.py --action check-all
  python scripts/keyword_alert.py --action remove --keyword "diffusion model"
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

SUBSCRIPTIONS_FILE = "./.academic-search-subscriptions.json"
ALERTS_FILE = "./.academic-search-alerts.jsonl"


def load_json(filepath, default=None):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_subscriptions():
    return load_json(SUBSCRIPTIONS_FILE, default={"subscriptions": []})


def save_subscriptions(data):
    save_json(SUBSCRIPTIONS_FILE, data)


def add_subscription(keyword, platform="lewen", frequency="daily"):
    """添加订阅"""
    data = load_subscriptions()
    subs = data["subscriptions"]

    # 检查是否已存在
    for s in subs:
        if s["keyword"] == keyword and s["platform"] == platform:
            return {"status": "exists", "message": f"订阅已存在: {keyword}@{platform}"}

    subs.append({
        "keyword": keyword,
        "platform": platform,
        "frequency": frequency,
        "created_at": datetime.now().isoformat(),
        "last_checked": None,
        "last_count": 0,
    })
    save_subscriptions(data)
    return {"status": "success", "message": f"已添加订阅: {keyword}@{platform} ({frequency})"}


def remove_subscription(keyword, platform=None):
    """移除订阅"""
    data = load_subscriptions()
    subs = data["subscriptions"]
    original_len = len(subs)

    if platform:
        subs = [s for s in subs if not (s["keyword"] == keyword and s["platform"] == platform)]
    else:
        subs = [s for s in subs if s["keyword"] != keyword]

    data["subscriptions"] = subs
    save_subscriptions(data)
    removed = original_len - len(subs)
    return {"status": "success", "message": f"已移除 {removed} 条订阅"}


def list_subscriptions():
    """列出所有订阅"""
    data = load_subscriptions()
    return {"status": "success", "subscriptions": data["subscriptions"]}


def mock_search(keyword, platform, since_date):
    """
    模拟搜索 API 调用（实际使用时替换为真实 API 调用）
    返回：{"total": N, "papers": [...]}
    """
    # 实际部署时替换为对应平台的真实 API 调用:
    # - giiisp: POST /first/paper/searchArxivByTitle {key: ...}
    # - openalex: GET /works?search=...&filter=publication_date:>...
    # - cnki: 需配合 Chrome CDP 执行检索
    return {
        "total": 0,
        "papers": [],
        "_note": "This is a mock. Replace with real API call in production.",
    }


def check_subscription(sub):
    """检查单个订阅是否有新论文"""
    keyword = sub["keyword"]
    platform = sub["platform"]
    last_checked = sub.get("last_checked")

    # 确定上次检查时间
    if last_checked:
        since = datetime.fromisoformat(last_checked)
    else:
        since = datetime.now() - timedelta(days=7)  # 首次检查最近 7 天

    # 执行搜索（模拟）
    result = mock_search(keyword, platform, since.isoformat())
    current_count = result.get("total", 0)
    last_count = sub.get("last_count", 0)
    new_count = max(0, current_count - last_count)

    # 更新订阅状态
    sub["last_checked"] = datetime.now().isoformat()
    sub["last_count"] = current_count

    alert = None
    if new_count > 0:
        alert = {
            "timestamp": datetime.now().isoformat(),
            "keyword": keyword,
            "platform": platform,
            "new_count": new_count,
            "total_count": current_count,
            "papers": result.get("papers", [])[:5],  # 取前 5 篇
        }

    return alert


def check_all_subscriptions():
    """检查所有订阅并生成推送报告"""
    data = load_subscriptions()
    subs = data["subscriptions"]

    if not subs:
        return {"status": "no_subscriptions", "message": "无活跃订阅"}

    alerts = []
    for sub in subs:
        alert = check_subscription(sub)
        if alert:
            alerts.append(alert)
            # 写入 alerts 日志
            with open(ALERTS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(alert, ensure_ascii=False) + "\n")

    save_subscriptions(data)

    if not alerts:
        return {"status": "no_updates", "message": "所有订阅均无新论文"}

    # 生成推送摘要
    summary_lines = ["# 学术订阅推送\n"]
    summary_lines.append(f"**检查时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    summary_lines.append(f"**活跃订阅**: {len(subs)} 个\n")
    summary_lines.append(f"**新增论文**: {sum(a['new_count'] for a in alerts)} 篇\n\n")

    for alert in alerts:
        summary_lines.append(f"## {alert['keyword']} ({alert['platform']})\n")
        summary_lines.append(f"新增 {alert['new_count']} 篇，累计 {alert['total_count']} 篇\n")
        for p in alert.get("papers", []):
            title = p.get("title", "Unknown")
            summary_lines.append(f"- {title}\n")
        summary_lines.append("\n")

    summary = "\n".join(summary_lines)

    return {
        "status": "success",
        "alerts_count": len(alerts),
        "total_new_papers": sum(a["new_count"] for a in alerts),
        "summary": summary,
        "alerts": alerts,
    }


def main():
    parser = argparse.ArgumentParser(description="Keyword subscription and alert system")
    parser.add_argument("--action", choices=["add", "remove", "list", "check-all"], required=True)
    parser.add_argument("--keyword", help="Keyword to subscribe/unsubscribe")
    parser.add_argument("--platform", default="giiisp", choices=["giiisp", "openalex", "cnki"])
    parser.add_argument("--frequency", default="daily", choices=["daily", "weekly"])
    args = parser.parse_args()

    if args.action == "add":
        if not args.keyword:
            print(json.dumps({"status": "error", "message": "--keyword required"}, ensure_ascii=False))
            sys.exit(1)
        result = add_subscription(args.keyword, args.platform, args.frequency)

    elif args.action == "remove":
        if not args.keyword:
            print(json.dumps({"status": "error", "message": "--keyword required"}, ensure_ascii=False))
            sys.exit(1)
        result = remove_subscription(args.keyword, args.platform)

    elif args.action == "list":
        result = list_subscriptions()

    elif args.action == "check-all":
        result = check_all_subscriptions()

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
