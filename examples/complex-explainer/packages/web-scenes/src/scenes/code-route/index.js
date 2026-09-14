import { qflowWordmark, qflowSymbol } from "../../shared/brand-marks.js";
import { scene } from "../../shared/scene.js";
import { routeCardsHtml, routeCardsCss } from "../../shared/route-cards.js";
import { codeJourneyCss, synthesisDetailsCss } from "./styles.js";
import { codeJourneyAnimation } from "./animation.js";
import { requireBeats } from "../../shared/beats.js";
const htmlIcon = `<svg viewBox="0 0 100 110"><path fill="#e66a36" d="M5 5H95L87 94L50 105L13 94Z"/><path fill="#f68c51" d="M50 13H86L79 88L50 97Z"/><path fill="#fff3e9" d="M24 24H77L76 36H38L39 47H75L71 78L50 85L28 78L26 62H39L40 69L50 72L60 69L62 58H27Z"/></svg>`;
const pointer = `<svg viewBox="0 0 60 76"><path d="M6 4L51 37L30 42L21 67Z" fill="#fff6fc" stroke="#382535" stroke-width="4" stroke-linejoin="round"/><path d="M14 18L32 36L25 39L21 47Z" fill="#f48abc"/></svg>`;
const bar = (name) =>
  `<div class="code-bar"><i></i><i></i><i></i><span>${name}</span><b>×</b></div>`;
const codeSamples = [
  'const scene = document.querySelector(".scene");',
  "const timeline = createTimeline({ fps: 30 });",
  'const title = scene.querySelector(".title");',
  "function update(frame) {",
  "  const progress = easeOut(frame / 24);",
  "  title.style.transform = translate(0, progress);",
  "  picture.style.opacity = progress;",
  "  board.reveal({ row: 1, at: 2.40 });",
  "  return { x: frame * 4, scale: 1.05 };",
  "}",
  "window.update = update;",
  "const clip = { start: 0, end: 128 };",
  "const spring = { stiffness: 120, damping: 12 };",
  "layout.place(card, { x: 480, y: 720 });",
  'caption.setText("Make it yours.");',
  "animate(logo, { rotate: 12, duration: 18 });",
];
const wave = (row) =>
  Array.from(
    { length: 62 },
    (_, i) =>
      `<i style="height:${6 + Math.abs(Math.sin(i * (1.17 + row * 0.19)) * Math.cos(i * 0.41 + row)) * 38}px"></i>`,
  ).join("");
export function renderCodeJourney(t, c, w, font, o, events, m) {
  const names = [
    "remotion",
    "hyperframes",
    "html",
    "play",
    "once",
    "variant",
    "copy",
    "duplicate",
    "tokens",
    "time",
    "different",
    "match",
    "retime",
    "water",
    "resume",
    "solution",
    "keep",
    "drop",
  ];
  requireBeats(events, names);
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame]));
  const entries = {
    codex: { image: m.codex },
    remotion: { image: m.remotion },
    hyperframes: { image: m.hyperframes },
    "play-remotion": { image: m.remotion },
    "play-hyperframes": { image: m.hyperframes },
  };
  for (const [i, key] of ["ranking", "podcast", "interview"].entries()) {
    entries["switch-" + i] = { media: m[key], start: b.once, end: b.variant + 8 };
    entries["row-" + i] = { media: m[key], start: b.time, end: b.water };
  }
  entries["original"] = { media: m.ranking, start: b.variant, end: b.copy + 9 };
  entries["proposed"] = { media: m.target, start: b.variant, end: b.copy + 9 };
  const html = `
<div class="code-ground"></div>${routeCardsHtml}
<div class="code-ide code-window"
  >${bar("scene.html")}<div class="ide-body"
    ><aside><b>▧</b><b>⌕</b><b>⑂</b><b>▣</b><b>⚙</b></aside
    ><nav
      >EXPLORER<br /><br />▾ src<br />　 scene.html<br />　 motion.js<br />　 styles.css<br /><br />▾
      assets<br />　 host.mp4<br />　 logo.svg</nav
    ><div class="ide-code"
      ><div class="file-tab">scene.html <span>×</span></div
      ><div class="code-lines live-code"></div></div></div
  ><div class="ide-status">● main <span>UTF-8　 HTML　 30fps</span></div></div
>
<div class="tool-icons"
  ><div class="tool remotion-tool">{{remotion}}</div
  ><div class="tool hyperframes-tool">{{hyperframes}}</div
  ><div class="tool html-tool">${htmlIcon}</div></div
>
<div class="motion-browser code-window"
  >${bar("localhost:3000")}<div class="playground"
    ><div class="play-grid"></div><div class="play-blob blob-0"></div
    ><div class="play-blob blob-1"></div><div class="toy toy-0">${qflowSymbol}</div
    ><div class="toy toy-1">{{play-remotion}}</div
    ><div class="toy toy-2">{{play-hyperframes}}</div>${Array.from({ length: 9 }, (_, i) => `<i class="pixel-spark spark-${i}"></i>`).join("")}</div
  ></div
>
<div class="once-stage"
  ><div class="switch-video code-window">${bar("video.mp4")}${[0, 1, 2].map((i) => `<div class="switch-shot shot-${i}">{{switch-${i}}}</div>`).join("")}</div
  ><div class="rewrite-code code-window"
    >${bar("scene.html")}<div class="code-lines reset-code"></div><div class="rewrite-caret"></div></div
></div>
<div class="variant-stage"
  ><div class="variant-card original-card">{{original}}</div
  ><div class="variant-arrow"
    ><svg viewBox="0 0 100 64">
      <path
        d="M8 22H56V6H68V18H80V30H92V42H80V54H68V62H56V46H8Z"
        fill="#382535"
        transform="translate(3 2)"
      />
      <path
        d="M4 18H52V2H64V14H76V26H88V38H76V50H64V58H52V42H4Z"
        fill="#f38fbd"
        stroke="#382535"
        stroke-width="3"
      />
      <path d="M12 25H56V16L72 30H12Z" fill="#ffdae9" /></svg></div
  ><div class="variant-card proposed-card">{{proposed}}<div class="wanted-outline"></div></div
></div>
<div class="duplicate-stage"
  ><div class="code-window source-code"
    >${bar("original.html")}<div class="code-lines source-lines"></div></div
  ><div class="code-transfer"
    ><svg viewBox="0 0 100 64">
      <path
        d="M8 22H56V6H68V18H80V30H92V42H80V54H68V62H56V46H8Z"
        fill="#382535"
        transform="translate(3 2)"
      />
      <path
        d="M4 18H52V2H64V14H76V26H88V38H76V50H64V58H52V42H4Z"
        fill="#f38fbd"
        stroke="#382535"
        stroke-width="3"
      />
      <path d="M12 25H56V16L72 30H12Z" fill="#ffdae9" /></svg></div
  ><div class="code-window destination-code"
    >${bar("new-video.html")}<div class="code-lines destination-lines"></div></div
  ><div class="token-meter"
    ><span>TOKENS</span><b>0</b
    ><svg class="pixel-fire" viewBox="0 0 12 16">
      <path d="M5 0H8V4H10V7H12V13H10V16H2V14H0V8H2V10H4V6H5Z" fill="#e34f82" />
      <path d="M6 7H8V11H10V14H8V16H4V14H3V11H5Z" fill="#ffd571" /></svg></div
></div>
<div class="retiming-stage">${[0, 1, 2].map((i) => `<div class="timing-row row-${i}"><div class="row-video">{{row-${i}}}</div><div class="row-script"><p>${["第一名，是属于我们的。", "今天我们来聊一聊这个话题。", "你会选择哪一个？"][i]}</p><div class="row-wave">${wave(i)}</div><div class="row-ruler"><i></i><i></i><i></i><i></i><i></i></div></div><div class="effect-chip effect-${i}"><span>${["#1", "▧", "ABC"][i]}</span><code class="effect-time">--.--s</code></div><div class="row-connector"></div></div>`).join("")}</div>
<div class="code-pointer"
  >${pointer}<div class="code-pointer-badge">{{codex}}</div><i class="code-click"></i
></div>
<div class="water-label"><span>✦</span> 战略性喝水 <span>✦</span><i>▰ ▰ ▰</i></div>
<div class="synthesis-mark"
  ><div class="synthesis-ring">${qflowSymbol}<b>Qflow</b></div
  ><svg class="join-lines" viewBox="0 0 800 240">
    <path
      d="M400 0V90Q400 120 370 120H130Q100 120 100 150V230M400 90Q400 120 430 120H670Q700 120 700 150V230"
    /></svg
></div>
<div class="kept-parts"
  ><div
    ><svg viewBox="0 0 90 65">
      <rect
        x="4"
        y="4"
        width="82"
        height="55"
        rx="3"
        fill="#ffd0e3"
        stroke="#382535"
        stroke-width="4"
      />
      <path d="M4 18H86M32 18V59" stroke="#382535" stroke-width="3" />
      <rect
        x="40"
        y="25"
        width="36"
        height="24"
        fill="#b2dacc"
        stroke="#382535"
        stroke-width="3"
      /></svg
    ><b>画布布局</b></div
  ><div
    ><svg viewBox="0 0 90 65">
      <path
        d="M30 13L10 32L30 51M60 13L80 32L60 51M51 7L39 57"
        fill="none"
        stroke="#382535"
        stroke-width="7"
      /></svg
    ><b>代码动效</b></div
  ></div
><div class="discarded"
  ><span
    ><svg viewBox="0 0 90 65">
      <path
        d="M30 13L10 32L30 51M60 13L80 32L60 51M51 7L39 57"
        fill="none"
        stroke="#382535"
        stroke-width="7"
      /></svg
    >重复代码</span
  ><span
    ><svg viewBox="0 0 90 65">
      <rect x="4" y="4" width="82" height="55" fill="#d4c4ef" stroke="#382535" stroke-width="4" />
      <path d="M13 22H70M13 33H57M13 44H76" stroke="#79598d" stroke-width="4" />
      <path d="M66 6V58" stroke="#e25781" stroke-width="4" /></svg
    >重抄时间点</span
  ><span
    ><svg viewBox="0 0 90 65">
      <path
        d="M20 48H75V58H20ZM13 32H68V45H13ZM23 14H78V28H23Z"
        fill="#f5cb70"
        stroke="#382535"
        stroke-width="4"
      />
      <path d="M31 17V26M43 17V26M55 17V26" stroke="#ae773d" stroke-width="3" /></svg
    >Token 开销</span
  ></div
>`;
  return scene(
    t,
    c,
    w,
    font,
    o,
    html,
    routeCardsCss + codeJourneyCss + synthesisDetailsCss,
    codeJourneyAnimation,
    events,
    entries,
    { codeSamples, duration: w.span.endFrameExclusive - w.span.startFrame },
  );
}
