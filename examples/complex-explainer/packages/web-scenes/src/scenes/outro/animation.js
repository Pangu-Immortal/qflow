// This scene owns its fixed design. External events arrive as projected frames.
export const animation = `
const $ = (s) => root.querySelector(s),
  columns = [...root.querySelectorAll(".portrait-column")];
const pop = (x) => {
  x = clamp(x);
  return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
};
const set = (el, a) => {
  el.style.opacity = String(clamp(a));
  el.style.visibility = a > 0 ? "inherit" : "hidden";
};
return (frame) => {
  const b = data.beats,
    f = frame;
  const tq = fade(f, b.overtime, b.github, 6);
  set($(".tears"), tq);
  [...root.querySelectorAll(".tear")].forEach((el, i) => {
    const age = Math.max(0, f - b.overtime),
      x = (i ? 594 : 443) + Math.sin(age * 0.025) * 2,
      y = 813 + Math.sin(age * 0.07) * 3;
    el.style.transform =
      "translate(" +
      x +
      "px," +
      y +
      "px) scaleY(" +
      (0.35 + 0.65 * ease(age / 9)) +
      ")";
    el.querySelector(".tear-drop").style.transform =
      "translateY(" + Math.floor(((age * 2 + i * 9) % 32) / 8) * 8 + "px)";
  });
  const github = fade(f, b.github, b.copy + 8, 8),
    copy = fade(f, b.copy, b.install + 7, 7),
    install = fade(f, b.install, b.gift + 8, 8),
    gift = fade(f, b.gift, b.bye + 9, 9),
    bye = ease((f - b.bye) / 12);
  paintBackdrop(f);
  set($(".backdrop"), github);
  set($(".outro-ground"), Math.max(copy, install, gift, f >= b.end ? 1 : 0));
  set($(".outro-page"), github);
  $(".outro-page").style.transform =
    "translateY(" +
    ((1 - ease((f - b.github) / 10)) * 65 - Math.max(0, f - b.github) * 0.8) +
    "px)";
  set($(".copy-panel"), copy);
  $(".copy-panel").style.transform =
    "translateY(" + (1 - pop((f - b.copy) / 12)) * 75 + "px)";
  const cq = clamp((f - b.copy) / Math.max(1, b.install - b.copy)),
    clicked = cq > 0.64;
  $(".copy-button").style.background = clicked ? "#bcdac3" : "#f8bbda";
  $(".copy-button span").textContent = clicked ? "Copied" : "Copy";
  $(".copy-button").style.transform =
    clicked && cq < 0.82 ? "translate(3px,3px)" : "none";
  $(".copy-highlight").style.opacity = clicked ? ".75" : "0";
  const pointer = $(".outro-pointer");
  set(pointer, copy);
  pointer.style.transform =
    "translate(" +
    (650 + 295 * ease(cq / 0.65)) +
    "px," +
    (1245 - 260 * ease(cq / 0.65)) +
    "px)";
  const ring = $(".click-ring"),
    rq = clamp((cq - 0.64) / 0.3);
  ring.style.opacity = String(clicked ? 1 - rq : 0);
  ring.style.transform = "scale(" + (1 + rq * 1.4) + ")";
  set($(".install-panel"), install);
  $(".install-panel").style.transform =
    "translateY(" + (1 - pop((f - b.install) / 13)) * 75 + "px)";
  const iq = clamp((f - b.install) / Math.max(1, b.gift - b.install));
  $(".installed-command").textContent = iq > 0.12 ? data.command : "";
  $(".caret").style.opacity = iq < 0.2 ? "1" : "0";
  const lines = [
    "◇ Fetching qflow-ai/qflow",
    "◇ Found skill: qflow",
    "◇ Installing to coding agents",
    "◆ Installation complete",
  ];
  $(".install-lines").textContent = lines
    .slice(0, Math.min(4, Math.floor(Math.max(0, iq - 0.18) * 5.2)))
    .join("\\n");
  $(".install-progress i").style.width =
    clamp((iq - 0.18) / 0.75) * 100 + "%";
  set($(".portrait-waterfall"), gift);
  const gq = clamp((f - b.gift) / Math.max(1, b.bye - b.gift));
  columns.forEach((col, i) => {
    const h = col.querySelector("img")?.naturalHeight || col.scrollHeight,
      travel = Math.max(
        0,
        h * (218 / (col.querySelector("img")?.naturalWidth || 218)) - 1560,
      ),
      speed = 0.34 + gq * 0.08;
    col.style.transform =
      "translateY(" + -travel * (i % 2 ? 1 - speed : speed) + "px)";
  });
  const final = ease((f - (b.end - 12)) / 30);
  set($(".farewell-logo"), final);
  const tagline = "Clone any viral video with AI agents.";
  const typed = Math.floor(clamp((f - b.end - 8) / 35) * tagline.length);
  [...root.querySelectorAll(".pixel-letter")].forEach(
    (el, i) => (el.style.visibility = i < typed ? "inherit" : "hidden"),
  );
  $(".farewell-logo").style.transform =
    "translateY(" +
    (1 - final) * 45 +
    "px) scale(" +
    (0.94 + 0.06 * final) +
    ")";
  set($(".star-card"), bye);
  $(".star-card").style.transform =
    "translateY(" +
    ((1 - pop((f - b.bye) / 15)) * 90 + final * 150) +
    "px) scale(" +
    (1 + 0.012 * Math.sin(Math.max(0, f - b.bye) * 0.09)) +
    ")";
  [...root.querySelectorAll(".star")].forEach(
    (s, i) =>
      (s.style.transform =
        "rotate(" + Math.sin((f - b.bye) * 0.08 + i * Math.PI) * 10 + "deg)"),
  );
};`;
