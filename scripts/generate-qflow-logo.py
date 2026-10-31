#!/usr/bin/env python3
"""
功能：程序化生成 Qflow 品牌 logo SVG（替换原 Qflow 视觉资产）

设计语言（沿用原品牌版式，仅换字形与品牌名）：
  - wordmark：几何无衬线大写（League Spartan wght=700），宽字距
  - 首字母 Q 用粉色渐变，其余字母单色（dark=#010101 / light=#ffffff）
  - mark：三条斜切平行四边形层叠，暗示 flow 动势，粉色渐变
  - line 版：mark + 空心描边 wordmark（outline 风格）

依赖：fontTools + brotli（读取 woff2 可变字体并实例化 wght 轴）

产物（docs/public/）：
  qflow-logo.svg / qflow-logo-dark.svg / qflow-logo-light.svg
  logo-mark.svg / logo-line-dark.svg / logo-line-light.svg

用法：python3 scripts/generate-qflow-logo.py
"""

from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REPO = Path(__file__).resolve().parent.parent
FONT = REPO / "node_modules/@fontsource-variable/league-spartan/files/league-spartan-latin-wght-normal.woff2"
OUT = REPO / "docs/public"

WORD = "QFLOW"
WEIGHT = 700
TRACKING = 0.10          # 字距（相对 upem）
PAD = 8                  # viewBox 内边距

# 原品牌粉色渐变 stop（沿用色板，保持视觉连续性）
GRAD_STOPS = [
    (0.00, "#e83f5f"), (0.14, "#e94765"), (0.33, "#ec5774"),
    (0.56, "#f1738c"), (0.80, "#f599af"), (0.95, "#f8bccb"),
]


def glyph_paths(word: str):
    """返回 [(char, svg_d, advance)]。

    坐标已烘焙进最终用户空间（y 向下、基线 y=0、cap 区约 100 单位高），
    不再依赖 path 的 transform 属性——否则 userSpaceOnUse 渐变会落在
    字形局部坐标系里，导致首字母只吃到渐变尾部的浅色。
    """
    font = TTFont(str(FONT))
    inst = instantiateVariableFont(font, {"wght": WEIGHT})
    gs = inst.getGlyphSet()
    cmap = inst.getBestCmap()
    upem = inst["head"].unitsPerEm
    scale = 100.0 / upem
    out = []
    for ch in word:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        # 字体 y 向上 → SVG y 向下：先 scale(s,-s)，字形原点即基线
        tp = TransformPen(pen, Transform(scale, 0, 0, -scale, 0, 0))
        gs[gname].draw(tp)
        out.append((ch, pen.getCommands(), gs[gname].width))
    return out, upem


def compose_wordmark(fills: list[str]) -> tuple[str, float, float, float, float]:
    """把字形拼成一行，返回 (paths_svg, x_min, y_min, x_max, y_max)。

    字形坐标已在 glyph_paths 中烘焙到用户空间，这里只做水平平移，
    且平移量直接写进 transform 的 translate（渐变坐标同处用户空间，不受影响）。
    """
    paths, upem = glyph_paths(WORD)
    scale = 100.0 / upem
    track = TRACKING * 100.0
    x = 0.0
    parts = []
    for (ch, d, adv), fill in zip(paths, fills):
        if d:
            parts.append(
                f'<path fill="{fill}" transform="translate({x:.2f},0)" d="{d}"/>'
            )
        x += adv * scale + track
    cap = 72.0   # League Spartan cap height 近似（100 单位制下）
    desc = 22.0
    y_min, y_max = -cap, desc
    return "\n    ".join(parts), 0.0, y_min, x - track, y_max


def gradient_def(gid: str, x1: float, y1: float, x2: float, y2: float) -> str:
    stops = "\n      ".join(
        f'<stop offset="{o}" stop-color="{c}"/>' for o, c in GRAD_STOPS
    )
    return (
        f'<linearGradient id="{gid}" x1="{x1:.1f}" y1="{y1:.1f}" '
        f'x2="{x2:.1f}" y2="{y2:.1f}" gradientUnits="userSpaceOnUse">\n'
        f"      {stops}\n    </linearGradient>"
    )


def mark_paths(size: float) -> str:
    """三条斜切平行四边形（flow 层叠），按 size 缩放。"""
    s = size / 32.0
    bars = [
        (8, 5, 27, 5, 23, 11, 4, 11),
        (5, 14, 29, 14, 25, 20, 1, 20),
        (11, 23, 22, 23, 18, 29, 7, 29),
    ]
    out = []
    for i, (x1, y1, x2, y2, x3, y3, x4, y4) in enumerate(bars):
        pts = " ".join(f"{v * s:.2f}" for v in (x1, y1)) + " " + \
              " ".join(f"{v * s:.2f}" for v in (x2, y2)) + " " + \
              " ".join(f"{v * s:.2f}" for v in (x3, y3)) + " " + \
              " ".join(f"{v * s:.2f}" for v in (x4, y4))
        out.append(f'<path fill="url(#mg{i})" d="M{pts} Z"/>')
    return "\n    ".join(out)


def mark_gradient_defs(size: float) -> str:
    s = size / 32.0
    defs = []
    for i, (y1, y2) in enumerate([(5, 11), (14, 20), (23, 29)]):
        defs.append(gradient_def(f"mg{i}", 4 * s, y1 * s, 28 * s, y2 * s))
    return "\n    ".join(defs)


def build_full_logo(rest_fill: str, name: str, with_title: bool) -> str:
    fills = [f"url(#wg)"] + [rest_fill] * (len(WORD) - 1)
    body, x0, y0, x1, y1 = compose_wordmark(fills)
    vb = f"{x0 - PAD:.1f} {y0 - PAD:.1f} {x1 - x0 + 2 * PAD:.1f} {y1 - y0 + 2 * PAD:.1f}"
    title = f"\n  <title>Qflow</title>" if with_title else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{title}
  <defs>
    {gradient_def("wg", 0, y0, 120, y1)}
  </defs>
  <g>
    {body}
  </g>
</svg>
"""


def build_line_logo(rest_stroke: str, name: str) -> str:
    """空心描边版：mark + outline wordmark。字形坐标已烘焙，仅水平平移。"""
    paths, upem = glyph_paths(WORD)
    scale = 100.0 / upem
    track = TRACKING * 100.0
    mark_w = 40.0
    gap = 14.0
    x = mark_w + gap
    parts = []
    for (ch, d, adv) in paths:
        if d:
            parts.append(
                f'<path fill="none" stroke="{rest_stroke}" stroke-width="2.2" '
                f'transform="translate({x:.2f},0)" d="{d}"/>'
            )
        x += adv * scale + track
    cap, desc = 72.0, 22.0
    total_w = x - track          # 已含 mark_w + gap + 字宽
    vb_h = cap + desc + 2 * PAD
    mark_scale = mark_w / 32.0   # mark 原为 32 单位见方，缩放到 mark_w 宽
    mark_h = 32.0 * mark_scale
    mark_y = -cap + (cap - mark_h) / 2.0   # 在 cap 区垂直居中
    svg = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-PAD:.1f} {-cap - PAD:.1f} '
        f'{total_w + 2 * PAD:.1f} {vb_h:.1f}">',
        "  <title>Qflow</title>",
        "  <defs>",
    ]
    svg.append("    " + mark_gradient_defs(32).replace(
        'id="mg0"', 'id="lg0"').replace('id="mg1"', 'id="lg1"').replace('id="mg2"', 'id="lg2"'))
    svg.append("  </defs>")
    # mark 放在左侧 [0, mark_w]，垂直居中于 cap 区
    svg.append(f'  <g transform="translate(0,{mark_y:.1f}) scale({mark_scale:.3f})">')
    svg.append("    " + mark_paths(32).replace("mg0", "lg0").replace("mg1", "lg1").replace("mg2", "lg2"))
    svg.append("  </g>")
    svg.append("  <g>")
    svg.append("    " + "\n    ".join(parts))
    svg.append("  </g>")
    svg.append("</svg>")
    return "\n".join(svg) + "\n"


def build_mark() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <title>Qflow</title>
  <defs>
    {mark_gradient_defs(32)}
  </defs>
  <g>
    {mark_paths(32)}
  </g>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    writes = {
        "qflow-logo-dark.svg": build_full_logo("#010101", "dark", False),
        "qflow-logo-light.svg": build_full_logo("#ffffff", "light", False),
        "qflow-logo.svg": build_full_logo("#010101", "full", True),
        "logo-mark.svg": build_mark(),
        "logo-line-dark.svg": build_line_logo("#010101", "line-dark"),
        "logo-line-light.svg": build_line_logo("#ffffff", "line-light"),
    }
    for name, content in writes.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print(f"✓ docs/public/{name} ({len(content)} bytes)")


if __name__ == "__main__":
    main()
