import { comparison_styles } from "./styles.js";
import { comparison_animation } from "./animation.js";
import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";
export function renderComparison(t, c, w, font, o, events, m) {
  requireBeats(events, ["other", "monthly", "templates", "cases", "watermark"]);
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame])),
    count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {};
  for (const [id, media, start, end] of [
    ["home-a", m.left, 0, b.monthly],
    ["home-b", m.right, b.other, b.monthly],
    ["price-a", m["price-a"], b.monthly, b.templates],
    ["price-b", m["price-b"], b.monthly, b.templates],
    ["templates-a", m["templates-a"], b.templates, b.cases],
    ["templates-b", m["templates-b"], b.templates, b.cases],
    ["case-a", m["case-a"], b.cases, count],
    ["case-b", m["case-b"], b.cases, count],
  ])
    entries[id] = {
      media,
      start,
      end: Math.min(count, end + 12),
      backdrop: id.startsWith("home") ? {} : { left: id.endsWith("-a") ? 0 : 50, width: 50 },
    };
  let stamps = "";
  for (const side of ["a", "b"])
    for (let i = 0; i < 12; i++) {
      const id = "stamp-" + side + i;
      entries[id] = { image: m["logo-" + side] };
      stamps += `<div class="stamp stamp-${side}" data-i="${i}" style="left:${(side === "a" ? 0 : 50) + (i % 3) * 16.66}%;top:${Math.floor(i / 3) * 23}%">{{${id}}}</div>`;
    }
  const pair = (name) =>
    `<div class="phase pair" data-p="${name}"><div class="panel panel-a">{{${name}-a}}</div><div class="panel panel-b">{{${name}-b}}</div></div>`;
  return scene(
    t,
    c,
    w,
    font,
    o,
    `<div class="mesh"></div><div class="heading"><b>Creatify</b><small>视频生成平台</small></div><div class="stage"><div class="phase" data-p="home-a"><div class="screen">{{home-a}}</div></div><div class="phase" data-p="home-b"><div class="screen">{{home-b}}</div></div>${pair("price")}${pair("templates")}${pair("case")}<div class="stamps">${stamps}</div></div><div class="brand-label label-a">Creatify<span>$39/月</span></div><div class="brand-label label-b">Higgsfield<span>$59/月</span></div>`,
    comparison_styles,
    comparison_animation,
    events,
    entries,
  );
}
