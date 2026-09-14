export const palette = Object.freeze({
  ink: "#281d2d",
  paper: "#fce5ee",
  pink: "#fa67aa",
  pinkSoft: "#f7c9df",
  cream: "#fff8fc",
  mint: "#b6e2c9",
  lilac: "#e1cef8",
});
export const paletteCss =
  ":scope{" +
  Object.entries(palette)
    .map(([name, value]) => "--" + name + ":" + value)
    .join(";") +
  "}";
