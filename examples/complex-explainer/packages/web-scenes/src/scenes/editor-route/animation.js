export const road_animation = `const single = new Map(),
  multiple = new Map();
const $ = (s) => {
  if (!single.has(s)) single.set(s, root.querySelector(s));
  return single.get(s);
};
const $$ = (s) => {
  if (!multiple.has(s)) multiple.set(s, [...root.querySelectorAll(s)]);
  return multiple.get(s);
};
const tech = $(".technical"),
  ctx = $(".field").getContext("2d"),
  routes = $(".routes"),
  cards = $$(".route"),
  heading = $(".road-heading"),
  editor = $(".editor"),
  timeline = $(".timeline"),
  folder = $(".folder"),
  pointer = $(".pointer"),
  generated = $(".generated"),
  sample = $(".sample");
const diamonds = $$(".diamond");
const lerp = (a, b, p) => a + (b - a) * p,
  smooth = (p) => {
    p = clamp(p);
    return p * p * (3 - 2 * p);
  },
  out = (p) => 1 - Math.pow(1 - clamp(p), 3),
  pop = (p) => {
    p = clamp(p);
    return 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);
  },
  visible = (el, a) => {
    el.style.opacity = String(clamp(a));
    el.style.visibility = a > 0 ? "inherit" : "hidden";
  };
const paintField = (f) => {
  ctx.fillStyle = data.palette.paper;
  ctx.fillRect(0, 0, 135, 240);
  ctx.fillStyle = "#f8d3e3";
  for (let y = 2; y < 240; y += 8)
    for (let x = 2; x < 135; x += 8) ctx.fillRect(x, y, 1, 1);
  const cross = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + 1, y, 1, 5);
    ctx.fillRect(x - 1, y + 2, 5, 1);
  };
  cross(16, 76, "#f591bd");
  cross(119, 183, "#c7afe5");
  cross(23, 207, "#b9d7c6");
};
const travel = (f, a, z, x0, y0, x1, y1, arc = 0) => {
  const p = smooth((f - a) / Math.max(1, z - a));
  return [lerp(x0, x1, p), lerp(y0, y1, p) - Math.sin(p * Math.PI) * arc];
};
paintField(0);
return (frame) => {
  const f = frame,
    b = data.beats;
  visible(tech, out((f - b.overview) / 12));
  visible(
    $(".homepage"),
    out((f - b.half) / 10) * (1 - out((f - b.overview) / 10)),
  );
  $(".homepage").style.transform =
    "translateY(" + (1 - out((f - b.half) / 14)) * 180 + "px)";
  const enter = out((f - b.overview) / 16),
    dock = smooth((f - b.editor) / 19),
    rscale = lerp(1, 0.5, dock);
  visible(routes, enter);
  routes.style.transform =
    "translateY(" + lerp(0, 400, dock) + "px) scale(" + rscale + ")";
  cards.forEach((el, i) => {
    const reveal = out((f - b.overview - i * 4) / 14),
      yaw = (i === 0 ? 18 : -18) + Math.sin(f * 0.01 + i) * 0.6;
    el.style.transform =
      "translateX(" +
      (i === 0 ? -1 : 1) * (1 - reveal) * 180 +
      "px) rotateY(" +
      yaw +
      "deg) translateZ(" +
      Math.sin(f * 0.02 + i) * 8 +
      "px) scale(" + (1 + .105 * Math.pow(Math.max(0, Math.sin((f-b.overview)/30*5-i*Math.PI)), 2) * (1-dock) * reveal) + ")";
    el.style.opacity = String(reveal * (i === 1 ? 1 - dock * 0.04 : 1));
  });
  const sweepAge=Math.max(0,f-b.editor-22)%141,sweepQ=sweepAge/24;
  const sweep=$('.selection-sweep');sweep.style.opacity=String(dock*(sweepAge<24?.46*Math.sin(sweepQ*Math.PI):0));sweep.style.transform='translateX('+(-130+sweepQ*680)+'px)';
  const mix=(a,z,p)=>'rgb('+a.map((v,i)=>Math.round(lerp(v,z[i],p))).join(',')+')';
  cards[0].querySelector('.route-face').style.background='linear-gradient(145deg,'+mix([255,190,218],[255,126,185],dock)+','+mix([245,139,190],[232,61,137],dock)+')';
  cards[1].querySelector('.route-face').style.background='linear-gradient(145deg,#d9c5fc,#b8a0e5)';
  visible(heading, enter * (1 - out((f - b.editor) / 9)));
  const demoOn = out((f - b.operate) / 12),
    icons = out((f - b.capcut) / 6) * (1 - out((f - b.assets) / 9)),
    assets = out((f - b.assets) / 10) * (1 - out((f - b.drag + 7) / 17)),
    keyMode = out((f - b.keys) / 10) * (1 - out((f - b.tokens) / 8));
  const editorOn = demoOn * (1 - out((f - b.number) / 7)) + keyMode;
  visible(editor, editorOn);
  const ordinary = 1 - keyMode,
    zoomCanvas = out((f - b.place) / 12) * (1 - out((f - b.number) / 7));
  editor.style.transform =
    "translateY(" +
    ((1 - demoOn) * 80 - zoomCanvas * 35) +
    "px) rotateX(" +
    ordinary * (1 - out((f - b.drag) / 12)) * 7 +
    "deg) rotateY(" +
    -ordinary * (1 - out((f - b.drag) / 12)) * 5 +
    "deg) scale(" +
    (1 + zoomCanvas * 0.1) +
    ")";
  editor.style.transformOrigin = "50% " + (zoomCanvas ? "28%" : "50%");
  visible($(".editor-top"), 1);
  visible($(".editor-bar"), 1);
  timeline.style.transform = "none";
  visible($(".editor-veil"), icons * 0.87 + assets * 0.7);
  visible($(".brands"), icons);
  ["capcut", "premiere", "resolve"].forEach((n) => {
    const el = $(".brand." + n),
      p = pop((f - b[n]) / 9),
      group = out((f - b.same) / 13);
    visible(el, out((f - b[n]) / 5));
    el.style.transform =
      "translateY(" +
      ((1 - out((f - b[n]) / 10)) * 90 - group * 20) +
      "px) rotateY(" +
      (1 - out((f - b[n]) / 10)) * -30 +
      "deg) scale(" +
      Math.max(0.05, p) * (1 + group * 0.14) +
      ")";
  });
  visible($(".brand-equality"), out((f - b.same) / 9));
  visible(folder, assets);
  folder.style.transform =
    "translateY(" +
    (1 - out((f - b.assets) / 10)) * 90 +
    "px) rotateX(" +
    lerp(18, 3, out((f - b.assets) / 15)) +
    "deg)";
  $$(".asset").forEach((el, i) => {
    const p = pop((f - b.assets - i * 3) / 9);
    visible(el, out((f - b.assets - i * 3) / 5));
    el.style.transform =
      "translateY(" +
      (1 - out((f - b.assets - i * 3) / 9)) * 55 +
      "px) scale(" +
      Math.max(0.05, p) +
      ")";
  });
  const dragged = out((f - b.drag) / 25);
  $$(".clip").forEach((el, i) => {
    const p = f < b.assets ? 1 : out((f - b.drag - i * 6 - 16) / 5);
    visible(el, p);
    el.style.transform = "scaleX(" + Math.max(0.01, p) + ")";
  });
  $$(".picture").forEach((el, i) => {
    const p =
      f < b.assets ? (i === 0 ? 1 : 0) : out((f - b.drag - i * 6 - 14) / 7);
    visible(el, p);
    el.style.filter =
      f >= b.fail && f < b.number && i === 1
        ? "drop-shadow(0 0 12px #e83f5f)"
        : "";
  });
  for (let i = 0; i < 2; i++) {
    const el = $(".d" + i),
      a = b.drag + i * 16,
      z = a + 19,
      q = clamp((f - a) / 19),
      pos = travel(f, a, z, 150 + i * 190, 175, 95 + i * 185, 412 + i * 50, 90);
    visible(el, f >= a && f < z ? 1 : 0);
    el.style.left = pos[0] + "px";
    el.style.top = pos[1] + "px";
    el.style.transform =
      "scale(" +
      lerp(1, 0.4, q) +
      ") rotate(" +
      Math.sin(q * Math.PI) * -8 +
      "deg)";
  }
  const failed = clamp((f - b.fail) / Math.max(1, b.number - b.fail)),
    path = $(".failed-path");
  visible(path, 0);
  const release = 0.49,
    pull =
      failed < release
        ? smooth(failed / release)
        : Math.exp((-7 * (failed - release)) / (1 - release)) *
          Math.cos((11 * (failed - release)) / (1 - release));
  const dx = 195 * pull,
    dy = -65 * pull,
    grab = $(".p1");
  grab.style.transform =
    "translate(" +
    dx +
    "px," +
    dy +
    "px) rotate(" +
    (-7 + pull * 13) +
    "deg) scale(" +
    (1 + Math.abs(pull) * 0.055) +
    ")";
  grab.style.outline = failed > 0 && failed < 1 ? "3px solid #ffbb91" : "none";
  grab.style.boxShadow =
    failed >= release && failed < 0.72
      ? "7px 7px 0 #ed6554"
      : "5px 5px 0 #251921";
  const examples = out((f - b.number) / 7) * (1 - out((f - b.keys) / 7));
  visible($(".motion-examples"), examples);
  $(".number-example>b").style.transform =
    "scale(" + Math.max(0.01, pop((f - b.number) / 11)) + ")";
  const ip = pop((f - b.image) / 22), flightPath = out((f - b.image) / 18);
  visible($(".image-example"), out((f - b.image) / 5));
  $(".flying-logo").style.transform =
    "translate(" +
    -330 * (1 - ip) +
    "px," +
    (170 * (1 - flightPath) - Math.sin(flightPath * Math.PI) * 85) +
    "px) rotate(" +
    -25 * (1 - ip) +
    "deg) scale(" +
    (0.6 + 0.4 * ip) +
    ")";
  const arrival=clamp((f-b.image-9)/24);
  $(".logo-burst").style.opacity=String(Math.sin(arrival*Math.PI));
  $(".logo-burst").style.transform="scale("+(.78+out(arrival)*.4)+")";
  visible(
    $(".pulse-ring"),
    Math.sin(clamp((f - b.number) / 18) * Math.PI) * 0.6,
  );
  $(".pulse-ring").style.transform =
    "scale(" + (1 + clamp((f - b.number) / 18) * 0.8) + ")";
  visible($(".keys"), keyMode);
  visible($(".key-label"), keyMode);
  const keyProgress = clamp((f - b.keys) / Math.max(1, b.tokens - b.keys - 6));
  $$(".diamond").forEach((el, i) => {
    const p = out((keyProgress * 25 - i - 0.7) / 0.3);
    visible(el, p);
    el.style.transform = "scale(" + (0.6 + 0.4 * p) + ")";
  });
  const cost = out((f - b.tokens) / 6) * (1 - out((f - b.generated) / 7));
  visible($(".terminal-cost"), cost);
  const cp = clamp((f - b.tokens) / Math.max(1, b.generated - b.tokens));
  const end = 1100 + Math.floor(cp * (data.code.length - 1100)),
    pre = $(".terminal-cost pre");
  paintTerminal(pre, data.code, end);
  $(".token-meter b").textContent = Math.floor(
    248630 * Math.pow(cp, 1.6),
  ).toLocaleString("en-US");
  visible(generated, out((f - b.generated) / 9)*clamp((data.count-f)/8));
  const g = out((f - b.generated) / 14),
    focus = smooth((f - b.unstable) / 12),
    fan = out((f - b.styles) / 9);
  sample.style.transform =
    "translateY(" +
    (1 - g) * 80 +
    "px) scale(" +
    (1.5 - 0.5 * g) * (1 + 0.28 * focus) * (1 - 0.36 * fan) +
    ")";
  sample.style.filter = "brightness(" + (1 - fan * 0.35) + ")";
  visible($(".sample-label"), 1 - focus);
  $$(".variant").forEach((el, i) => {
    const prep = out((f - b.unstable) / 8),
      p = out((f - b.styles - i * 2) / 8);
    visible(el, prep * 0.09 + p * 0.91);
    el.style.transform =
      "rotateY(" +
      (i === 1 ? -1 : 1) * (1 - p) * 42 +
      "deg) translateZ(" +
      p * 30 +
      "px) scale(" +
      (0.82 + 0.18 * p) +
      ")";
  });
  $$(".connectors path").forEach((el, i) => {
    const p = out((f - b.styles - i * 2) / 7);
    el.style.strokeDashoffset = String(500 * (1 - p));
    el.style.opacity = String(p);
  });
  visible($(".lock"), out((f - b.styles) / 6));
  let point = [460, 440],
    click = 0,
    show = 0;
  if (f >= b.operate && f < b.capcut) {
    const t = f - b.operate,
      k = Math.floor(t / 15),
      p = clamp((t % 15) / 10),
      targets = [
        [130, 420],
        [490, 470],
        [330, 590],
        [790, 425],
        [620, 490],
      ],
      a = targets[k % 5],
      z = targets[(k + 1) % 5];
    point = travel(p, 0, 1, ...a, ...z, 30);
    click = Math.max(0, 1 - (t % 15) / 5);
    show = 1;
  } else if (f >= b.drag && f < b.place) {
    const i = f - b.drag < 16 ? 0 : 1,
      a = b.drag + i * 16;
    point = travel(
      f,
      a,
      a + 19,
      160 + i * 190,
      185,
      110 + i * 185,
      430 + i * 50,
      90,
    );
    show = 1;
    click = f > a + 17 ? 1 - clamp((f - a - 17) / 6) : 0;
  } else if (f >= b.place && f < b.fail) {
    point = travel(f, b.place, b.fail, 360, 180, 530, 155, 25);
    show = 1;
  } else if (f >= b.fail && f < b.number) {
    const sc = 1 + zoomCanvas * 0.1;
    point = [
      510 + (260 + dx - 510) * sc,
      174 + (140 + dy - 174) * sc - zoomCanvas * 35,
    ];
    show = 1;
    click = failed < 0.49 ? 1 : Math.max(0, 1 - (failed - 0.49) * 6);
  } else if (f >= b.keys && f < b.tokens) {
    const n = Math.min(24, Math.floor(keyProgress * 25)),
      phase = (keyProgress * 25) % 1,
      prev = Math.max(0, n - 1),
      dest = (i) => [
        timeline.offsetLeft + diamonds[i].offsetLeft,
        timeline.offsetTop + diamonds[i].offsetTop,
      ];
    const a = dest(prev),
      z = dest(n),
      q = smooth(clamp(phase / 0.7));
    point = [
      lerp(a[0], z[0], q),
      lerp(a[1], z[1], q) - Math.sin(q * Math.PI) * 15,
    ];
    show = 1;
    click = phase > 0.7 ? Math.sin(((phase - 0.7) / 0.3) * Math.PI) : 0;
  }
  pointer.style.transform =
    "translate(" +
    point[0] +
    "px," +
    point[1] +
    "px) scale(" +
    (1 - click * 0.1) +
    ")";
  visible(pointer, show);
  visible($(".click-ring"), click * 0.8);
  $(".click-ring").style.transform = "scale(" + (1 + (1 - click) * 1.3) + ")";
  $(".playhead").style.left = 65 + ((f * 0.9) % 850) + "px";
};
`;
