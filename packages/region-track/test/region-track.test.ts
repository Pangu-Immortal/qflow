import assert from "node:assert/strict";
import test from "node:test";

import { sealTimeline } from "@qflow/timeline";

import { resolveRegionTrack } from "../src/index.js";

test("Region Track resolves normalized evidence inside any explicit program Frame", () => {
  const timeline = sealTimeline({ id: "program", frameCount: 3, frameRate: { numerator: 30, denominator: 1 } });
  const track = resolveRegionTrack({
    path: "/project/tracking.svs#heads.default",
    properties: {
      series: [{ id: "GUEST", regions: [[0.5, 0.1, 0.2, 0.3], null, [0.52, 0.11, 0.2, 0.3]] }],
    },
  }, { xPx: 100, yPx: 200, widthPx: 400, heightPx: 800 }, timeline);

  assert.deepEqual(track.series[0]?.frames[0], { xPx: 300, yPx: 280, widthPx: 80, heightPx: 240 });
  assert.equal(track.series[0]?.frames[1], null);
  assert.equal(track.timelineId, timeline.id);
});

test("Region Track rejects implicit gaps and geometry outside its declared Frame", () => {
  const timeline = sealTimeline({ id: "program", frameCount: 1, frameRate: { numerator: 30, denominator: 1 } });
  assert.throws(() => resolveRegionTrack({
    path: "/project/tracking.svs#heads.default",
    properties: { series: [{ id: "GUEST", regions: [[0.9, 0.1, 0.2, 0.3]] }] },
  }, { xPx: 0, yPx: 0, widthPx: 100, heightPx: 100 }, timeline), /inside its Frame/u);
});
