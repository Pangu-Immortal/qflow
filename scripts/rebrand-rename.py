#!/usr/bin/env python3
"""
功能：重命名 git 跟踪的含品牌词文件与目录（Qflow → Qflow）

设计要点：
  1. 按路径深度倒序处理：先改最深叶子，避免父目录改名后子路径失效。
  2. 统一走 git mv 保留历史（--dry-run 仅打印）。
  3. 只替换路径中最后一段（basename）的品牌词，逐段向上处理，保证
     skills/qflow/references/x.md → skills/qflow/references/x.md 正确。
  4. 幂等：已无品牌词的条目自动跳过。

用法：
  python3 scripts/rebrand-rename.py --dry-run
  python3 scripts/rebrand-rename.py --apply
"""

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# 词根替换（大小写敏感），与文本替换脚本保持一致
PAIRS = [
    ("QFLOWHUB", "QFLOWHUB"), ("QflowHub", "QflowHub"), ("qflowhub", "qflowhub"),
    ("QFLOW", "QFLOW"), ("Qflow", "Qflow"), ("qflow", "qflow"),
]


def rename_token(name: str) -> str:
    """替换单个路径片段中的品牌词。"""
    for old, new in PAIRS:
        name = name.replace(old, new)
    return name


def tracked_paths_with_brand() -> list[str]:
    """git 跟踪且路径含品牌词的文件（含目录下的文件）。"""
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout
    return [
        line for line in out.splitlines()
        if any(old in line for old, _ in PAIRS)
    ]


def collect_dir_renames() -> list[tuple[str, str]]:
    """收集需要改名的目录（去重），按深度倒序返回 (旧, 新)。"""
    dirs: dict[str, str] = {}
    for f in tracked_paths_with_brand():
        parts = Path(f).parts
        # 逐层重建路径，找出所有含品牌词的祖先目录
        for i in range(1, len(parts)):
            old_rel = "/".join(parts[:i])
            if any(old in parts[i - 1] for old, _ in PAIRS):
                new_rel = "/".join(
                    rename_token(p) for p in parts[:i]
                )
                dirs.setdefault(old_rel, new_rel)
    # 深度倒序：先改最深目录
    return sorted(dirs.items(), key=lambda kv: kv[0].count("/"), reverse=True)


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("--dry-run", "--apply"):
        print("用法: rebrand-rename.py --dry-run | --apply")
        return 2
    do_apply = sys.argv[1] == "--apply"

    def run(cmd: list[str]) -> tuple[bool, str]:
        r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
        return r.returncode == 0, (r.stderr or r.stdout).strip()

    moved = 0

    # 1) 目录（深度倒序）
    for old_rel, new_rel in collect_dir_renames():
        if not (REPO / old_rel).exists():
            continue  # 父目录已改过名，路径失效则跳过
        if old_rel == new_rel:
            continue
        cmd = ["git", "mv", old_rel, new_rel]
        if do_apply:
            ok, err = run(cmd)
            if not ok:
                print(f"✗ 目录改名失败 {old_rel} -> {new_rel}: {err[:120]}")
                return 1
        print(f"  [dir ] {old_rel} -> {new_rel}")
        moved += 1

    # 2) 文件（basename 含品牌词者）
    files = tracked_paths_with_brand()
    # 目录改名后路径已变，重新取一次真实存在的文件
    if do_apply:
        files = tracked_paths_with_brand()
    else:
        # dry-run：把路径中的目录段按规则改名后判断
        files = [f for f in files]

    for f in sorted(files):
        p = Path(f)
        new_parts = [rename_token(x) for x in p.parts]
        new_rel = "/".join(new_parts)
        if new_rel == f:
            continue
        if do_apply:
            # 目录改名后，旧路径可能已不存在；跳过由 git 自动跟随的条目
            if not (REPO / f).exists():
                continue
            ok, err = run(["git", "mv", f, new_rel])
            if not ok:
                if "does not exist" in err or "not under version control" in err:
                    continue
                print(f"✗ 文件改名失败 {f} -> {new_rel}: {err[:120]}")
                return 1
        print(f"  [file] {f} -> {new_rel}")
        moved += 1

    print(f"\n共 {moved} 个路径待/已改名 (apply={do_apply})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
