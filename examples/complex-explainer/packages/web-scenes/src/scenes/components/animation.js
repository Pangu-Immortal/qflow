import { portraitMotion } from "../../shared/studio-art.js";
// This scene owns its fixed design. External events arrive as projected frames.
export const animation = `
return (f) => {
  const b = data.beats,
    zoom = smooth((f - b.all) / 20),
    lib = smooth((f - b.library) / 22),
    reuse = smooth((f - b.reuse) / 22),
    variants = ease((f - b.variants) / 10),
    boxStart = ease((f - b.caption) / 20);
  show($(".component-editor"), 1 - zoom);
  show($(".hero-person"), (1 - boxStart * 0.8) * (1 - lib));
  move(
    $(".hero-person"),
    mix(410, 320, zoom),
    mix(735, 650, zoom),
    mix(0.6, 1.18, zoom),
  );
  show($(".component-library"), lib * (1 - reuse));
  show($(".new-creators"), reuse * (1 - variants));
  show($(".tile-world"), 1 - variants);
  animateTiles(f); ${portraitMotion}
  const times = [b.caption, b.ranking, b.chart, b.card],
    offsets = [
      [25, 430, 0.64],
      [12, 205, 0.4],
      [220, 110, 0.28],
      [180, 340, 0.36],
    ],
    land = [
      [78, 980, 0.6],
      [400, 810, 0.42],
      [810, 825, 0.34],
      [730, 1100, 0.48],
    ];
  $$(".effect-tile").forEach((el, i) => {
    const boxed = smooth((f - times[i]) / 15),
      hs = mix(0.6, 1.18, zoom),
      hx = mix(410, 320, zoom),
      hy = mix(735, 650, zoom);
    let x = hx + offsets[i][0] * hs,
      y = hy + offsets[i][1] * hs,
      s = offsets[i][2] * hs;
    x = mix(x, 100 + (i % 2) * 475, boxed);
    y =
      mix(y, 715 + Math.floor(i / 2) * 320, boxed) -
      Math.sin(boxed * Math.PI) * 40;
    s = mix(s, 0.9, boxed);
    x = mix(x, 255 + (i % 2) * 305, lib);
    y = mix(y, 810 + Math.floor(i / 2) * 260, lib);
    s = mix(s, 0.61, lib);
    const q = smooth((f - b.reuse - i * 3) / 20);
    x = mix(x, land[i][0], q);
    y = mix(y, land[i][1], q) - Math.sin(q * Math.PI) * 95;
    s = mix(s, land[i][2], q);
    move(el, x, y, s);
    show(el, 1);
    const shell = boxed * (1 - reuse);
    el.style.background = "rgba(255,248,234," + shell + ")";
    el.style.borderColor = "rgba(130,82,125," + shell + ")";
    el.style.boxShadow = "8px 9px rgba(56,37,53," + shell + ")";
    show(el.querySelector(".tile-cap"), shell);
    show(
      el.querySelector(".tile-corners"),
      Math.sin(clamp((f - times[i]) / 24) * Math.PI),
    );
  });
  const ghost = fade(f, 4, b.all, 7),
    g = smooth((f - 10) / 22);
  show($(".copy-ghost"), ghost);
  move(
    $(".copy-ghost"),
    mix(435, 310, g),
    mix(900, 1250, g),
    mix(0.65, 1, g),
  );
  show($(".work-pointer"), ghost);
  move($(".work-pointer"), mix(545, 445, g), mix(935, 1280, g));
  $(".hs-playhead").style.left = 220 + f * 1.4 + "px";
  $$(".new-creator").forEach(
    (el, i) =>
      (el.style.transform =
        "translateY(" + (1 - pop((f - b.reuse - i * 2) / 17)) * 90 + "px)"),
  );
  show($(".variant-trio"), variants);
  $$(".trio-card").forEach((el, i) => {
    const q = pop((f - [b.word, b.picture, b.color][i]) / 11),
      swap = smooth((f - b.swap - i * 2) / 13);
    el.style.transform =
      "translateY(" +
      (1 - q) * 100 +
      "px) rotateY(" +
      Math.sin(swap * Math.PI) * -15 +
      "deg) scale(" +
      (0.85 + 0.15 * q) +
      ")";
    show(el, ease((f - [b.word, b.picture, b.color][i]) / 8));
    show(el.querySelector(".trio-first"), 1 - swap);
    show(el.querySelector(".trio-next"), swap);
  });
};`;
