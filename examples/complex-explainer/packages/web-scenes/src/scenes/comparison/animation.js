export const comparison_animation = `const phases = [...root.querySelectorAll("[data-p]")],
  h = root.querySelector(".heading b"),
  sub = root.querySelector(".heading small"),
  stage = root.querySelector(".stage");
return (frame) => {
  paintBackdrop(frame);
  const b = data.beats,
    p =
      frame >= b.cases
        ? "case"
        : frame >= b.templates
          ? "templates"
          : frame >= b.monthly
            ? "price"
            : frame >= b.other
              ? "home-b"
              : "home-a";
  const windows = {
    "home-a": [0, b.other + 12],
    "home-b": [b.other, b.monthly + 12],
    price: [b.monthly, b.templates + 12],
    templates: [b.templates, b.cases + 12],
    case: [b.cases, data.count],
  };
  phases.forEach((el) => {
    const [start, end] = windows[el.dataset.p],
      q = ease((frame - start) / 12),
      leaving = clamp((frame - (end - 12)) / 12);
    el.style.opacity = String(fade(frame, start, end, 12));
    if (el.dataset.p.startsWith("home"))
      el.style.transform =
        "translateX(" +
        ((el.dataset.p === "home-a" ? -1 : 1) * (1 - q) * 85 - leaving * 60) +
        "px) scale(" +
        (1.035 - q * 0.035) +
        ")";
    else {
      el.querySelectorAll(".panel").forEach(
        (panel, i) =>
          (panel.style.transform =
            "translateX(" +
            (i === 0 ? 1 : -1) * (1 - q) * 150 +
            "px) translateY(" +
            (1 - q) * 35 +
            "px) scale(" +
            (1.045 - q * 0.045) +
            ")"),
      );
    }
  });
  h.textContent =
    p === "home-a"
      ? "Creatify"
      : p === "home-b"
        ? "Higgsfield"
        : p === "price"
          ? "月付方案"
          : p === "templates"
            ? "模板选择"
            : frame >= b.watermark
              ? "水印"
              : "案例对比";
  h.style.fontSize = p === "home-b" ? "74px" : "84px";
  sub.textContent = p.startsWith("home")
    ? "视频生成平台"
    : p === "price"
      ? "Creatify ＋ Higgsfield"
      : p === "templates"
        ? "两家的模板界面"
        : frame >= b.watermark
          ? "品牌标识示意"
          : "提供的生成案例";
  const pair = !p.startsWith("home"),
    price = p === "price";
  root.querySelectorAll(".brand-label").forEach((el) => {
    el.style.opacity = String(fade(frame, b.monthly, b.templates, 7));
    el.style.top = "1200px";
    el.querySelector("span").style.display = price ? "block" : "none";
  });
  stage.style.height = "770px";
  root.querySelectorAll(".stamp").forEach((el) => {
    const q = ease((frame - b.watermark - Number(el.dataset.i) * 1.3) / 5);
    el.style.opacity = String(q * 0.7);
    el.style.transform = "rotate(-18deg) scale(" + (1.25 - q * 0.25) + ")";
  });
};
`;
