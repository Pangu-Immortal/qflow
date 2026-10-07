import { packReleaseCandidate } from "./release-candidate.mjs";

const candidate = await packReleaseCandidate();
console.log("Release candidate prepared without publishing:");
for (const tarball of candidate.independent) console.log(`  ${tarball}`);
console.log(`  ${candidate.distribution}`);
console.log(`  ${candidate.plan}`);
