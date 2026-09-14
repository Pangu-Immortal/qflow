import { portraitMotion } from "../../shared/studio-art.js";
// This scene owns its fixed design. External events arrive as projected frames.
export const animation = `
const codePane = $(".script-source pre"),
  sourceLines = codePane.innerHTML.split("<br>");
codePane.innerHTML = sourceLines
  .map(
    (line, i) =>
      '<div class="source-line" data-line="' +
      i +
      '"><i class="source-line-no">' +
      String(i + 1).padStart(2, "0") +
      '</i><span class="source-line-body">' +
      (line || "&nbsp;") +
      "</span></div>",
  )
  .join("");
return (f) => {
  const b = data.beats,
    match = ease((f - b.bind) / 10),
    expand = smooth((f - b.bind) / 13),
    examples = fade(f, b.examples, b["rewrite-scene"] + 6, 6),
    rewrite = fade(f, b["rewrite-scene"], b.syntax + 8, 6),
    syntax = ease((f - b.syntax) / 10),
    changed = smooth((f - b.rewrite) / 8),
    voiced = smooth((f - b.voice) / 8),
    adapt = smooth((f - b.adapt) / 24);
  show($(".semantic-studio"), 1 - ease((f - b.examples) / 10));
  show($(".semantic-board"), 1 - syntax);
  show($(".semantic-preview"), 0);
  show($(".semantic-examples"), examples);
  show($(".rewrite-sheet"), rewrite);
  show($(".script-source"), syntax);
  $(".script-source").style.transform =
    "translateY(" + (1 - pop((f - b.syntax) / 13)) * 35 + "px)";
  $$(".source-line").forEach((el, i) => {
    const q = ease((f - b.syntax - i * 1.3) / 7);
    el.style.opacity = String(q);
    el.style.transform = "translateX(" + (1 - q) * 16 + "px)";
  });
  $$(".script-source em").forEach((el, i) => {
    const q = Math.sin(clamp((f - b.syntax - 8 - i * 3) / 17) * Math.PI);
    el.style.boxShadow = "0 0 " + q * 12 + "px #ef91b8";
    el.style.background = "rgba(244,164,202," + (0.4 + 0.5 * q) + ")";
  }); ${portraitMotion}
  const examplePos = ease((f - b.examples) / 18),
    baseTop = mix(1174, 980, expand),
    baseScale = mix(0.58, 1, expand),
    boardTop = mix(mix(baseTop, 1160, examplePos), 1080, changed),
    boardScale = mix(mix(baseScale, 0.66, examplePos), 0.85, changed);
  $(".semantic-board").style.top = boardTop + "px";
  const scaleX = mix(1, 0.75, examplePos * (1 - changed));
  $(".semantic-board").style.transform =
    "scale(" + scaleX + "," + boardScale + ")";
  const updated = f >= b.voice;
  show($(".bank-original"), updated ? 0 : 1);
  show($(".bank-revised"), updated ? 1 : 0);
  const left = updated ? 115 : 155,
    steps = [125, 253, 386, 215, 386],
    phase =
      clamp((f - b.bind - 13) / Math.max(1, b.examples - b.bind - 20)) * 4,
    i = Math.min(3, Math.floor(phase)),
    edge = mix(steps[i], steps[i + 1], smooth((phase - i) / 0.55)),
    width = updated ? 451 : edge;
  const sel = $(".selected-words"),
    effect = $(".effect-window");
  sel.style.left = left + "px";
  sel.style.width = width + "px";
  effect.style.left = 130 + left + "px";
  effect.style.width = width + "px";
  show(effect, match);
  show(sel, match);
  const pulse = Math.sin(clamp((f - b.adapt) / 22) * Math.PI);
  effect.style.boxShadow = "0 0 " + pulse * 15 + "px #d789ba";
  effect.style.background =
    "rgb(" +
    Math.round(237 + 10 * pulse) +
    "," +
    Math.round(173 + 25 * pulse) +
    "," +
    Math.round(208 + 17 * pulse) +
    ")";
  $(".semantic-moment").style.left = left + width + "px";
  $(".semantic-playhead").style.left = 150 + ((f * 0.85) % 700) + "px";
  const pointer = $(".work-pointer"),
    drag = smooth((f - b.bind - 10) / 8);
  show(pointer, match * (1 - ease((f - b.examples) / 6)));
  move(
    pointer,
    mix(530, 35 + 505 + (130 + left + width - 505) * scaleX, drag),
    mix(boardTop - 3, boardTop + 285 * boardScale, drag),
  );
  const reveal = clamp((f - b.rank) / 17);
  $(".rank-front").style.transform =
    "rotateX(" + -180 * smooth(reveal) + "deg)";
  $(".rank-back").style.transform =
    "rotateX(" + (180 - 180 * smooth(reveal)) + "deg)";
  const fly = pop((f - b.product) / 19);
  show($(".flying-brand"), ease((f - b.product) / 8));
  $(".flying-brand").style.transform =
    "translate(" +
    (1 - fly) * -380 +
    "px," +
    (1 - fly) * -210 +
    "px) rotate(" +
    (1 - fly) * -35 +
    "deg) scale(" +
    (0.5 + 0.5 * fly) +
    ")";
  show($(".pixel-stars"), Math.sin(clamp((f - b.product) / 28) * Math.PI));
  show($(".rewrite-old"), 1 - changed);
  show($(".rewrite-new"), changed);
  $$(".voice-shape i").forEach((el, i) => {
    const old =
        (0.12 + 0.88 * Math.abs(Math.sin(i * 0.13) * Math.cos(i * 0.39))) *
        (10 + 68 * Math.abs(Math.sin(i * 2.17))),
      next =
        (0.08 +
          0.92 * Math.abs(Math.cos(i * 0.09 + 1) * Math.sin(i * 0.31 + 2))) *
        (9 + 72 * Math.abs(Math.cos(i * 1.79)));
    el.style.height = mix(old, next, voiced) + "px";
    el.style.background = voiced > 0.5 ? "#9a72bc" : "#c074a5";
  });
  $(".voice-chip").style.background = voiced > 0.5 ? "#e5d0f4" : "#f3d6e6";
};`;
