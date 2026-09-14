export const terminalSetup = `
function paintTerminal(pre, text, characters) {
  const content = text.slice(0, Math.max(0, Math.floor(characters)));
  if (pre.textContent !== content) pre.textContent = content;
  pre.scrollTop = pre.scrollHeight;
}`;
