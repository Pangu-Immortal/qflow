/** Preserve an authored npm compatibility range when removing the workspace transport prefix. */
export function releaseDependencyVersion(owner, name, declared) {
  if (typeof declared !== "string") throw new Error(`${owner} dependency ${name} has no range`);
  if (!declared.startsWith("workspace:")) return declared;
  const range = declared.slice("workspace:".length);
  if (["", "*", "^", "~"].includes(range)) {
    throw new Error(`${owner} must declare an explicit compatibility range for ${name}, not ${declared}`);
  }
  return range;
}
