#!/usr/bin/env python3
"""
功能：Qflow → Qflow 品牌重命名脚本（一次性迁移工具）

设计要点：
  1. 规则「先长后短」排序：GitHub org 复合串 → 文档链接精确映射 → 功能性 URL →
     社交账号 → QflowHub 词根 → 主品牌词根。顺序错会把 Qflow 切成 Qflowit。
  2. 大小写敏感字面替换，保证 QFLOW/Qflow/qflow 与驼峰标识各自正确。
  3. qflow.ai 按用途分流：
       - docs/guide、docs/zh/guide、quickstart → 精确映射到本仓 GitHub blob 路径
       - provider baseUrl / OAuth / pricing 等功能端点 → qflow.ai（新品牌域名）
       - 裸域名与文档首页 → GitHub 仓库主页
  4. 只处理 git 跟踪的文本文件；本脚本自身排除，避免自我替换。
  5. --dry-run 先统计不落盘，并额外做「危险规则自检」。

用法：
  python3 scripts/rebrand-qflow.py --dry-run
  python3 scripts/rebrand-qflow.py --apply
"""

import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SELF = Path(__file__).resolve()

GITHUB_ORG = "Pangu-Immortal"
GITHUB_REPO = f"https://github.com/{GITHUB_ORG}/qflow"
BLOB = f"{GITHUB_REPO}/blob/main"

# 主品牌与 QflowHub 服务的基础词根替换（大小写三态）
BASE_PAIRS = [
    ("QFLOW", "QFLOW"),
    ("Qflow", "Qflow"),
    ("qflow", "qflow"),
]
HUB_PAIRS = [
    ("QFLOWHUB", "QFLOWHUB"),
    ("QflowHub", "QflowHub"),
    ("qflowhub", "qflowhub"),
]

# 文档站路径 → 仓库内 md 的映射（docs/guide 与 docs/zh/guide 实测均存在于本仓）
DOC_GUIDE_RE = re.compile(r"https://qflow\.ai/(zh/)?guide/([a-z0-9-]+)/?")
DOC_QUICKSTART_RE = re.compile(r"https://qflow\.ai/(zh/)?quickstart/?")

# 固定规则表：顺序即优先级，不可随意调整
FIXED_RULES: list[tuple[str, str]] = [
    # ── 1. GitHub org 复合引用（最长，最先）──
    ("qflow-ai/qflowhub", f"{GITHUB_ORG}/qflowhub"),
    ("qflow-ai/qflow.git", f"{GITHUB_ORG}/qflow.git"),
    ("qflow-ai/qflow", f"{GITHUB_ORG}/qflow"),
    ("qflow-ai%2Fqflowhub", f"{GITHUB_ORG}%2Fqflowhub"),
    ("qflow-ai%2Fqflow", f"{GITHUB_ORG}%2Fqflow"),
    ("qflow-ai", GITHUB_ORG),

    # ── 2. npm scope 的 URL 编码形态（badge / mirror 测试用）──
    ("%40qflow%2Fqflow", "%40qflow%2Fqflow"),
    ("%40qflow", "%40qflow"),

    # ── 3. 功能性 API 端点（必须先于裸域名，否则被 GitHub 主页吃掉）──
    ("https://qflow.ai/v1", "https://qflow.ai/v1"),
    ("https://qflow.ai/oauth", "https://qflow.ai/oauth"),
    ("https://qflow.ai/api-reference", "https://qflow.ai/api-reference"),
    ("https://qflow.ai/commercial", "https://qflow.ai/commercial"),
    ("https://qflow.ai/files", "https://qflow.ai/files"),
    ("https://qflow.ai/assets", "https://qflow.ai/assets"),

    # ── 4. 裸域名与官网提及 → GitHub 仓库主页 ──
    ("https://qflow.ai", GITHUB_REPO),
    ("qflow.ai", f"github.com/{GITHUB_ORG}/qflow"),

    # ── 5. 社交账号与 shields badge slug ──
    ("x.com/qflowai", f"x.com/{GITHUB_ORG}"),
    ("t.me/qflowai", GITHUB_REPO),
    ("discord.gg/85hnyQnxpn", f"github.com/{GITHUB_ORG}/qflow/issues"),
    ("logo=qflow", "logo=qflow"),
    ("qflowai", "qflowai"),
]

SKIP_PARTS = {"node_modules", ".git", "dist", ".venv", "__pycache__"}


def map_doc_links(text: str, hits: Counter) -> str:
    """把文档站链接精确映射到仓库内 md 的 GitHub blob 路径。"""

    def guide(m: re.Match) -> str:
        zh, name = m.group(1) or "", m.group(2)
        hits["doc:guide"] += 1
        return f"{BLOB}/docs/{zh}guide/{name}.md"

    def quickstart(m: re.Match) -> str:
        zh = m.group(1) or ""
        hits["doc:quickstart"] += 1
        return f"{BLOB}/docs/{zh}quickstart.md"

    text = DOC_GUIDE_RE.sub(guide, text)
    text = DOC_QUICKSTART_RE.sub(quickstart, text)
    return text


def apply_rules(text: str) -> tuple[str, Counter]:
    """按序应用全部规则，返回新文本与命中统计。"""
    hits: Counter = Counter()

    # 文档链接精确映射优先（内含 qflow.ai，必须早于通用域名规则）
    text = map_doc_links(text, hits)

    for old, new in FIXED_RULES:
        if old in text:
            hits[old] += text.count(old)
            text = text.replace(old, new)

    # QflowHub 词根（不含裸 "Hypi"，避免把 Qflow 切成 Qflowit）
    for old, new in HUB_PAIRS:
        if old in text:
            hits[old] += text.count(old)
            text = text.replace(old, new)

    # 主品牌词根兜底
    for old, new in BASE_PAIRS:
        if old in text:
            hits[old] += text.count(old)
            text = text.replace(old, new)

    return text, hits


def tracked_text_files() -> list[Path]:
    """git 跟踪且含品牌词的文件（git grep -il 已排除二进制）。"""
    out = subprocess.run(
        ["git", "grep", "-il", "-e", "qflow", "-e", "qflowhub", "--", "."],
        cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout
    files = []
    for line in out.splitlines():
        p = (REPO / line.strip()).resolve()
        if not p.is_file() or p == SELF:
            continue
        if SKIP_PARTS & set(p.relative_to(REPO).parts):
            continue
        files.append(p)
    return files


def self_check() -> None:
    """规则自检：确保不会产出畸形词（回归护栏）。"""
    bad = {
        "Qflowit": "Qflow 被裸 Hypi 规则截断",
        "QflowHubit": "QflowHub 规则重叠",
        "qflow.ai/v1/v1": "v1 端点重复替换",
        "github.com/Pangu-Immortal/qflow/v1": "baseUrl 被文档链规则误吃",
    }
    probe = (
        "Qflow QFLOW qflow QflowHub qflowhub QFLOWHUB "
        "https://qflow.ai/v1 https://qflow.ai/guide/develop/ "
        "https://qflow.ai/zh/guide/runtime/ https://qflow.ai/quickstart/ "
        "https://qflow.ai qflow.ai qflow-ai/qflow @qflow/media qflowPackage "
        "data-qflow-text-run __qflowFrameProgram qflow_whisperx_service "
        "QFLOW_WHISPERX_PORT qflow-source qflow.project qflow.package@1 "
        "x.com/qflowai %40qflow%2Fqflow logo=qflow"
    )
    out, _ = apply_rules(probe)
    print("=== 自检样本转换结果 ===")
    print(out)
    print()
    for frag, why in bad.items():
        if frag in out:
            print(f"✗ 自检失败：发现 {frag!r} —— {why}")
            sys.exit(1)
    print("✓ 自检通过：无畸形词")
    print()


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("--dry-run", "--apply"):
        print("用法: rebrand-qflow.py --dry-run | --apply")
        return 2
    do_apply = sys.argv[1] == "--apply"

    self_check()

    files = tracked_text_files()
    print(f"待处理文件: {len(files)}  (apply={do_apply})")

    total: Counter = Counter()
    changed = 0
    for p in files:
        original = p.read_text(encoding="utf-8", errors="surrogateescape")
        new, hits = apply_rules(original)
        if not hits:
            continue
        changed += 1
        total += hits
        if do_apply:
            p.write_text(new, encoding="utf-8", errors="surrogateescape")

    print(f"命中文件: {changed}")
    print(f"替换总次数: {sum(total.values())}")
    print("\n按规则命中统计:")
    for rule, n in total.most_common(30):
        print(f"  {n:>6}  {rule}")
    if not do_apply:
        print("\n[dry-run] 未写入任何文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
