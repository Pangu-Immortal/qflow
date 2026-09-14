export const requireBeats = (events, names) => {
  for (const n of names) if (!events.some((e) => e.name === n)) throw Error("Missing Beat " + n);
};
