#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
期刊质量甄别脚本
输入期刊名称（可选ISSN），返回期刊等级、风险提示
"""

import argparse
import json
import re
import sys


# ============================================================
# 期刊数据库（精简高频期刊，覆盖人文社科、理工、医学）
# ============================================================

JOURNAL_DB = {
    # ===== CSSCI 来源期刊（人文社科类代表性期刊）=====
    "经济研究": {"level": "CSSCI", "core": True, "category": "经济学", "note": "权威期刊"},
    "管理世界": {"level": "CSSCI", "core": True, "category": "管理学", "note": "权威期刊"},
    "中国社会科学": {"level": "CSSCI", "core": True, "category": "综合社科", "note": "顶级期刊"},
    "法学研究": {"level": "CSSCI", "core": True, "category": "法学", "note": "权威期刊"},
    "政治学研究": {"level": "CSSCI", "core": True, "category": "政治学", "note": ""},
    "教育研究": {"level": "CSSCI", "core": True, "category": "教育学", "note": "权威期刊"},
    "文学评论": {"level": "CSSCI", "core": True, "category": "文学", "note": ""},
    "历史研究": {"level": "CSSCI", "core": True, "category": "历史学", "note": "权威期刊"},
    "哲学研究": {"level": "CSSCI", "core": True, "category": "哲学", "note": ""},
    "社会学研究": {"level": "CSSCI", "core": True, "category": "社会学", "note": ""},
    "新闻与传播研究": {"level": "CSSCI", "core": True, "category": "新闻传播学", "note": ""},
    "图书馆学报": {"level": "CSSCI", "core": True, "category": "图书情报学", "note": ""},
    "中国图书馆学报": {"level": "CSSCI", "core": True, "category": "图书情报学", "note": "权威期刊"},
    "情报学报": {"level": "CSSCI", "core": True, "category": "图书情报学", "note": ""},
    "大学图书馆学报": {"level": "CSSCI", "core": True, "category": "图书情报学", "note": ""},
    "图书情报工作": {"level": "CSSCI", "core": True, "category": "图书情报学", "note": ""},
    "档案学通讯": {"level": "CSSCI", "core": True, "category": "档案学", "note": ""},
    "心理学报": {"level": "CSSCI", "core": True, "category": "心理学", "note": ""},
    "心理科学进展": {"level": "CSSCI", "core": True, "category": "心理学", "note": ""},
    "体育科学": {"level": "CSSCI", "core": True, "category": "体育学", "note": ""},
    "外语教学与研究": {"level": "CSSCI", "core": True, "category": "外国语言文学", "note": ""},
    "中国语文": {"level": "CSSCI", "core": True, "category": "语言学", "note": ""},
    "中国翻译": {"level": "CSSCI", "core": True, "category": "翻译学", "note": ""},
    "中国工业经济": {"level": "CSSCI", "core": True, "category": "经济学", "note": ""},
    "金融研究": {"level": "CSSCI", "core": True, "category": "经济学", "note": ""},
    "会计研究": {"level": "CSSCI", "core": True, "category": "管理学", "note": ""},
    "中国行政管理": {"level": "CSSCI", "core": True, "category": "公共管理", "note": ""},
    "公共管理学报": {"level": "CSSCI", "core": True, "category": "公共管理", "note": ""},
    "高等教育研究": {"level": "CSSCI", "core": True, "category": "教育学", "note": ""},
    "北京大学教育评论": {"level": "CSSCI", "core": True, "category": "教育学", "note": ""},
    "文艺研究": {"level": "CSSCI", "core": True, "category": "文学", "note": ""},
    "中国现代文学研究丛刊": {"level": "CSSCI", "core": True, "category": "文学", "note": ""},
    "近代史研究": {"level": "CSSCI", "core": True, "category": "历史学", "note": ""},
    "世界历史": {"level": "CSSCI", "core": True, "category": "历史学", "note": ""},
    "中共党史研究": {"level": "CSSCI", "core": True, "category": "政治学", "note": ""},
    "国际问题研究": {"level": "CSSCI", "core": True, "category": "政治学", "note": ""},
    "世界经济与政治": {"level": "CSSCI", "core": True, "category": "政治学", "note": ""},
    "中国法学": {"level": "CSSCI", "core": True, "category": "法学", "note": "权威期刊"},
    "中外法学": {"level": "CSSCI", "core": True, "category": "法学", "note": ""},
    "法学家": {"level": "CSSCI", "core": True, "category": "法学", "note": ""},
    "现代传播": {"level": "CSSCI", "core": True, "category": "新闻传播学", "note": ""},
    "国际新闻界": {"level": "CSSCI", "core": True, "category": "新闻传播学", "note": ""},
    "新闻记者": {"level": "CSSCI", "core": True, "category": "新闻传播学", "note": ""},

    # ===== 北大核心（理工类代表性期刊）=====
    "计算机学报": {"level": "北大核心", "core": True, "category": "计算机科学", "note": "T1级"},
    "软件学报": {"level": "北大核心", "core": True, "category": "计算机科学", "note": "T1级"},
    "计算机研究与发展": {"level": "北大核心", "core": True, "category": "计算机科学", "note": "T1级"},
    "通信学报": {"level": "北大核心", "core": True, "category": "通信", "note": ""},
    "电子学报": {"level": "北大核心", "core": True, "category": "电子信息", "note": "T1级"},
    "自动化学报": {"level": "北大核心", "core": True, "category": "自动化", "note": "T1级"},
    "中国电机工程学报": {"level": "北大核心", "core": True, "category": "电气工程", "note": "T1级"},
    "电力系统自动化": {"level": "北大核心", "core": True, "category": "电气工程", "note": ""},
    "机械工程学报": {"level": "北大核心", "core": True, "category": "机械工程", "note": "T1级"},
    "材料研究学报": {"level": "北大核心", "core": True, "category": "材料科学", "note": ""},
    "金属学报": {"level": "北大核心", "core": True, "category": "材料科学", "note": ""},
    "化工学报": {"level": "北大核心", "core": True, "category": "化学工程", "note": ""},
    "环境科学": {"level": "北大核心", "core": True, "category": "环境科学", "note": "T1级"},
    "环境科学学报": {"level": "北大核心", "core": True, "category": "环境科学", "note": ""},
    "生态学报": {"level": "北大核心", "core": True, "category": "生态学", "note": ""},
    "土木工程学报": {"level": "北大核心", "core": True, "category": "土木工程", "note": ""},
    "建筑学报": {"level": "北大核心", "core": True, "category": "建筑学", "note": ""},
    "中国公路学报": {"level": "北大核心", "core": True, "category": "交通运输", "note": ""},
    "测绘学报": {"level": "北大核心", "core": True, "category": "测绘", "note": ""},
    "地理学报": {"level": "北大核心", "core": True, "category": "地理学", "note": ""},
    "遥感学报": {"level": "北大核心", "core": True, "category": "遥感", "note": ""},
    "航空学报": {"level": "北大核心", "core": True, "category": "航空", "note": ""},
    "宇航学报": {"level": "北大核心", "core": True, "category": "航天", "note": ""},
    "兵工学报": {"level": "北大核心", "core": True, "category": "兵器", "note": ""},
    "中国科学": {"level": "北大核心", "core": True, "category": "综合", "note": "顶级期刊"},
    "科学通报": {"level": "北大核心", "core": True, "category": "综合", "note": "顶级期刊"},
    "数学学报": {"level": "北大核心", "core": True, "category": "数学", "note": ""},
    "物理学报": {"level": "北大核心", "core": True, "category": "物理学", "note": ""},
    "化学学报": {"level": "北大核心", "core": True, "category": "化学", "note": ""},
    "中国农业大学学报": {"level": "北大核心", "core": True, "category": "农业", "note": ""},
    "中国农业科学": {"level": "北大核心", "core": True, "category": "农业", "note": ""},

    # ===== 北大核心（医学类代表性期刊）=====
    "中华医学杂志": {"level": "北大核心", "core": True, "category": "医学综合", "note": "顶级期刊"},
    "中国医学科学院学报": {"level": "北大核心", "core": True, "category": "医学综合", "note": ""},
    "中华内科杂志": {"level": "北大核心", "core": True, "category": "内科", "note": ""},
    "中华外科杂志": {"level": "北大核心", "core": True, "category": "外科", "note": ""},
    "中华护理杂志": {"level": "北大核心", "core": True, "category": "护理", "note": ""},
    "中华流行病学杂志": {"level": "北大核心", "core": True, "category": "预防医学", "note": ""},
    "中华预防医学杂志": {"level": "北大核心", "core": True, "category": "预防医学", "note": ""},
    "药学学报": {"level": "北大核心", "core": True, "category": "药学", "note": ""},
    "中国中药杂志": {"level": "北大核心", "core": True, "category": "中药学", "note": ""},
    "中国中西医结合杂志": {"level": "北大核心", "core": True, "category": "中西医结合", "note": ""},

    # ===== 科技核心（部分）=====
    "计算机应用": {"level": "科技核心", "core": True, "category": "计算机科学", "note": ""},
    "计算机应用研究": {"level": "科技核心", "core": True, "category": "计算机科学", "note": ""},
    "计算机工程": {"level": "科技核心", "core": True, "category": "计算机科学", "note": ""},
    "计算机工程与应用": {"level": "科技核心", "core": True, "category": "计算机科学", "note": ""},
    "微电子学与计算机": {"level": "科技核心", "core": True, "category": "微电子", "note": ""},
    "现代电子技术": {"level": "科技核心", "core": True, "category": "电子", "note": ""},
    "电子技术应用": {"level": "科技核心", "core": True, "category": "电子", "note": ""},

    # ===== 已知水刊/预警期刊（部分示例）=====
    "欧洲临床医学杂志": {"level": "预警期刊", "core": False, "category": "医学", "note": "发文量异常，被多单位预警", "risk": "高度风险：疑似掠夺性期刊"},
    "国际临床医学杂志": {"level": "预警期刊", "core": False, "category": "医学", "note": "发文量异常", "risk": "高度风险：疑似掠夺性期刊"},
    "现代教育前沿": {"level": "假刊", "core": False, "category": "教育", "note": "冒名正规期刊", "risk": "极高风险：确认为假刊"},
    "教育学文摘": {"level": "假刊", "core": False, "category": "教育", "note": "无正规出版资质", "risk": "极高风险：确认为假刊"},
    "基层建设": {"level": "假刊", "core": False, "category": "综合", "note": "军队内部刊物，市面版本为假刊", "risk": "极高风险：确认为假刊"},
}

# 名称关键词规则（用于不在数据库中的期刊推断）
KEYWORD_RULES = [
    # 权威标识
    {"keywords": ["中国科学", "科学通报", "经济研究", "管理世界"], "level": "权威", "core": True, "confidence": "高"},
    # CSSCI高概率关键词
    {"keywords": ["学报"], "excludes": ["学院学报", "职业技术学院学报"], "level": "北大核心/科技核心", "core": True, "confidence": "中", "note": "985/211高校学报多数为核心期刊"},
    # 假刊/水刊特征词
    {"keywords": ["国际", "前沿", "现代", "新"], "suffixes": ["杂志", "期刊", "前沿"], "level": "需警惕", "core": False, "confidence": "低", "note": "名称含'国际''前沿'等词且无知名主办单位需谨慎核实"},
]


def normalize_name(name):
    """规范化期刊名称：去除书名号、空格、统一大小写"""
    name = name.strip()
    name = re.sub(r'[《》<>]', '', name)
    name = re.sub(r'\s+', '', name)
    return name


def exact_match(name):
    """精确匹配"""
    norm = normalize_name(name)
    if norm in JOURNAL_DB:
        return {"match_type": "精确匹配", **JOURNAL_DB[norm]}
    # 尝试反向查找（去除"学报"等后缀的变体）
    return None


def fuzzy_match(name):
    """模糊匹配：查找包含关系"""
    norm = normalize_name(name)
    # 直接包含
    for db_name, info in JOURNAL_DB.items():
        if norm in db_name or db_name in norm:
            return {"match_type": "模糊匹配", "matched_name": db_name, **info}
    return None


def rule_inference(name):
    """基于名称规则推断"""
    norm = normalize_name(name)
    for rule in KEYWORD_RULES:
        matched = False
        for kw in rule.get("keywords", []):
            if kw in norm:
                matched = True
                break
        if not matched:
            continue
        # 检查排除词
        excluded = False
        for ex in rule.get("excludes", []):
            if ex in norm:
                excluded = True
                break
        if excluded:
            continue
        return {
            "match_type": "规则推断",
            "level": rule["level"],
            "core": rule["core"],
            "confidence": rule["confidence"],
            "note": rule.get("note", ""),
            "risk": rule.get("risk", "")
        }
    return None


def check_journal(name, issn=None):
    """主检查函数"""
    result = {
        "input_name": name,
        "normalized_name": normalize_name(name),
        "issn": issn,
        "match_type": None,
        "level": None,
        "core": False,
        "category": None,
        "note": "",
        "risk": "",
        "confidence": "高",
        "suggestion": ""
    }

    # 1. 精确匹配
    exact = exact_match(name)
    if exact:
        result.update(exact)
        result["suggestion"] = generate_suggestion(result)
        return result

    # 2. 模糊匹配
    fuzzy = fuzzy_match(name)
    if fuzzy:
        result.update(fuzzy)
        result["suggestion"] = generate_suggestion(result)
        return result

    # 3. 规则推断
    inferred = rule_inference(name)
    if inferred:
        result.update(inferred)
        result["suggestion"] = generate_suggestion(result)
        return result

    # 4. 无法判断
    result["match_type"] = "未匹配"
    result["level"] = "未知"
    result["confidence"] = "低"
    result["note"] = "该期刊不在内置数据库中，无法自动判断等级"
    result["suggestion"] = "建议通过以下方式核实：1）查询知网/万方该期刊详情页的收录情况；2）查询该期刊主办单位是否为正规高校或科研机构；3）确认是否为北大核心/CSSCI来源期刊最新目录收录期刊。"
    return result


def generate_suggestion(result):
    """生成使用建议"""
    level = result.get("level", "")
    risk = result.get("risk", "")
    core = result.get("core", False)

    if "预警" in level or "假刊" in level:
        return "不建议投稿或引用。如已发表，建议联系所在单位科研管理部门确认是否认可。"
    if "需警惕" in level:
        return "需谨慎核实。建议查询该期刊的ISSN、主办单位、出版周期等信息，确认是否为正规期刊。"
    if core:
        if "CSSCI" in level:
            return "核心期刊，学术认可度高，适合作为毕业论文参考文献或投稿目标。"
        if "北大核心" in level:
            return "北大核心期刊，学术认可度较高，适合作为参考文献。"
        if "科技核心" in level:
            return "中国科技核心期刊，理工医类认可度较好，适合作为参考文献。"
    return "普通期刊，建议结合论文质量综合判断是否适合作为重要参考文献。"


def main():
    parser = argparse.ArgumentParser(description="期刊质量甄别工具")
    parser.add_argument("--name", required=True, help="期刊名称（可含书名号）")
    parser.add_argument("--issn", default=None, help="ISSN号（可选）")
    args = parser.parse_args()

    result = check_journal(args.name, args.issn)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
