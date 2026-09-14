export const intro_animation = `const phases = [...root.querySelectorAll("[data-p]")],
  h = root.querySelector(".heading b"),
  sub = root.querySelector(".heading small");
return (frame) => {
  paintBackdrop(frame);
  const b = data.beats,
    p =
      frame >= b.examples
        ? 4
        : frame >= b.thirty
          ? 3
          : frame >= b.install
            ? 2
            : frame >= b.language
              ? 1
              : 0;
  const starts = [0, b.language, b.install, b.thirty, b.examples],
    ends = [
      b.language + 12,
      b.install + 12,
      b.thirty + 12,
      b.examples + 12,
      data.count,
    ];
  phases.forEach((el) => {
    const i = Number(el.dataset.p);
    el.style.opacity = String(fade(frame, starts[i], ends[i], 8));
    if (i < 4)
      el.style.transform =
        "translateY(" + (1 - ease((frame - starts[i]) / 10)) * 25 + "px)";
  });
  const titles = [
    ["Qflow", "开源视频复刻框架"],
    ["SVML", "视频领域语言"],
    ["Qflow Skill", "Codex ＋ Claude"],
    ["30 min", "从参考到成片"],
    [
      frame >= b.face ? "你的版本" : "爆款原片",
      frame >= b.face ? "换脸 · 换产品" : "Ranking · Podcast · Interview",
    ],
  ];
  h.textContent = titles[p][0];
  h.style.fontSize = p === 2 ? "77px" : p === 4 ? "84px" : "100px";
  sub.textContent = titles[p][1];
  for (const name of ["codex", "claude"]) {
    const q = ease((frame - b[name]) / 7),
      el = root.querySelector(".app-" + name);
    el.style.opacity = String(q);
    el.style.transform =
      "translateY(" + (1 - q) * 55 + "px) scale(" + (0.65 + q * 0.35) + ")";
  }
  const typed = Math.floor(
    clamp((frame - b.thirty) / Math.max(1, b.examples - b.thirty)) *
      data.terminal.length,
  );
  paintTerminal(root.querySelector("pre"), data.terminal, typed);
  root.querySelectorAll(".card").forEach((el, i) => {
    const q = ease((frame - b.examples - i * 4) / 12),
      x = (i === 0 ? -430 : i === 1 ? 430 : 0) * (1 - q),
      y = (i === 2 ? 160 : 45) * (1 - q),
      raw = clamp((frame - b.face - i * 2) / 16),
      flip = ease(raw),
      hit = Math.sin(Math.PI * raw);
    el.style.opacity = String(q);
    el.style.transform =
      "translate3d(" +
      x +
      "px," +
      (y - hit * 22) +
      "px," +
      hit * 90 +
      "px) rotateY(" +
      (i === 0 ? 28 : i === 1 ? -28 : 0) * (1 - q) +
      "deg) rotate(" +
      (i === 0 ? -2 : i === 1 ? 2 : 0) * q * (1 - flip) +
      "deg) scale(" +
      (1 + hit * 0.045) +
      ")";
    const target = el.querySelector(".target"),
      original = el.querySelector(".original");
    target.style.opacity = String(clamp((flip - 0.3) / 0.3));
    target.style.transform =
      "perspective(900px) rotateY(" +
      90 * (1 - flip) +
      "deg) scale(" +
      (1.09 - flip * 0.09) +
      ")";
    original.style.opacity = String(1 - clamp((flip - 0.3) / 0.3));
    original.style.transform =
      "perspective(900px) rotateY(" + -90 * flip + "deg)";
    const sweep = el.querySelector(".swap-sweep");
    sweep.style.opacity = String(hit * 0.8);
    sweep.style.transform = "translateX(" + (-110 + raw * 220) + "%)";
    el.style.boxShadow = "0 20px 40px #0009,0 0 " + hit * 32 + "px #ed557f99";
  });
};
`;
