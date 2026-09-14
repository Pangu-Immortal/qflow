// This scene owns its fixed design. External events arrive as projected frames.
export const animation = `
return (f) => {
  const b = data.beats,
    asset = ease((f - b.assets) / 13),
    publish = smooth((f - b.upload) / 17),
    compare = smooth((f - b.compare) / 20),
    meta = smooth((f - b.meta) / 17),
    guess = smooth((f - b.guess) / 20);
  show($(".delivery-studio"), 1 - publish);
  $(".delivery-studio").style.transform =
    "scale(" + (1 + 0.025 * asset) + ")";
  $$(".asset-thumb").forEach((el, i) => {
    const ready = ease((f - b.assets - i * 7) / 9);
    show(el.querySelector(".asset-picture"), ready);
    show(el.querySelector(".pixel-loading"), 1 - ready);
    el.querySelectorAll(".pixel-loading i").forEach(
      (dot, j) =>
        (dot.style.opacity = ((Math.floor(f / 3) + j) % 9) / 10 + 0.1),
    );
    el.querySelector(".asset-progress i").style.width =
      clamp((f + 15 - i * 4) / Math.max(1, b.assets + i * 7 + 8)) * 100 + "%";
  });
  show($(".studio-film"), ease((f - b.assets - 21) / 12));
  $(".hs-playhead").style.left = 210 + f * 1.7 + "px";
  const left = $(".phone-left"),
    right = $(".phone-right");
  show(left, publish);
  move(
    left,
    mix(391, mix(330, 70, compare), publish),
    mix(760, 665, publish),
    mix(0.6, 1, publish),
  );
  show(right, compare);
  move(right, 590 + (1 - compare) * 420, 665, 1);
  show($(".work-pointer"), 0);
  $(".post-film").style.transform = "translateY(" + -meta * 100 + "%)";
  $(".post-water").style.transform = "translateY(" + (1 - meta) * 100 + "%)";
  show($(".post-water"), meta);
  $(".post-clone").style.transform = "translateY(" + -guess * 100 + "%)";
  $(".post-reference").style.transform =
    "translateY(" + (1 - guess) * 100 + "%)";
  show($(".post-reference"), guess);
  show($(".phone-question"), guess);
  show($(".phone-brand"), meta);
  $(".phone-brand").style.transform =
    "scale(" +
    (1 + 0.12 * Math.sin(clamp((f - b.brand) / 17) * Math.PI)) +
    ")";
  const growth = ease((f - b.upload) / 40);
  $$(".heart-total").forEach(
    (el) =>
      (el.textContent = Math.floor(120 + growth * 89880).toLocaleString(
        "en-US",
      )),
  );
  $$(".comment-total").forEach(
    (el) =>
      (el.textContent = Math.floor(24 + growth * 2310).toLocaleString(
        "en-US",
      )),
  );
  $$(".share-total").forEach(
    (el) =>
      (el.textContent = Math.floor(18 + growth * 8740).toLocaleString(
        "en-US",
      )),
  );
  show($(".floating-hearts"), publish * (1 - compare));
  $$(".floating-hearts i").forEach((el, i) => {
    const q = ((Math.max(0, f - b.upload) + i * 6) % 43) / 43;
    el.style.transform =
      "translate(" +
      -20 * Math.sin(q * 6 + i) +
      "px," +
      (550 - q * 390) +
      "px) scale(" +
      (0.5 + 0.7 * Math.sin(q * Math.PI)) +
      ")";
    show(el, Math.sin(q * Math.PI));
  });
};`;
