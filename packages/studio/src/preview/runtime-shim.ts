import { audioEnvelopeGainAt } from "@qflow/qflow/composition";

/**
 * Studio's frame driver for a compiled HTML renderer document.
 *
 * HTML renderer remains the owner of layout and animation. Studio only supplies
 * an absolute Program frame, places every timed Present/material at that
 * instant, and waits until a discrete media seek is actually decoded.
 */
function shim(): string {
  return String.raw`
<script>
(function () {
  var muted = false;
  var root = document.querySelector('[data-qflow-program-root]');
  var numerator = Number(root && root.getAttribute('data-qflow-frame-numerator')) || 30;
  var denominator = Number(root && root.getAttribute('data-qflow-frame-denominator')) || 1;
  var fps = numerator / denominator;
  var frameSeconds = 1 / fps;
  var currentSeconds = 0;
  var playing = false;
  var seekRevision = 0;
  if (root) {
    root.style.width = (root.getAttribute('data-qflow-width') || '0') + 'px';
    root.style.height = (root.getAttribute('data-qflow-height') || '0') + 'px';
  }

  var visualClips = [];
  for (var clip of document.querySelectorAll('.qflow-visual-present')) {
    visualClips.push({
      element: clip,
      startFrame: Number(clip.getAttribute('data-qflow-present-start-frame')),
      endFrame: Number(clip.getAttribute('data-qflow-present-end-frame'))
    });
  }
  // Sampling runs are separate video elements with their own absolute spans.
  // Addressing only their containing Present makes every run paint at once.
  var media = [];
  for (var element of document.querySelectorAll('.qflow-visual-present video')) {
    var present = element.closest('.qflow-visual-present');
    var ownStart = element.getAttribute('data-start');
    var ownDuration = element.getAttribute('data-duration');
    media.push({
      element: element,
      startFrame: Number(element.getAttribute('data-qflow-start-frame')),
      endFrame: Number(element.getAttribute('data-qflow-end-frame')),
      sourceFrame: element.getAttribute('data-qflow-source-frame').split('/').map(BigInt),
      sourceRate: element.getAttribute('data-qflow-source-rate').split('/').map(BigInt),
      sourceFps: element.getAttribute('data-qflow-source-fps').split('/').map(Number)
    });
  }
  var audioContext;
  var programAudio = [];
  for (var element of document.querySelectorAll('.qflow-studio-audio')) {
    programAudio.push({
      element: element,
      start: parseFloat(element.getAttribute('data-start') || '0') || 0,
      duration: parseFloat(element.getAttribute('data-duration') || '0') || 0,
      mediaStart: parseFloat(element.getAttribute('data-media-start') || '0') || 0,
      mediaEnd: parseFloat(element.getAttribute('data-media-end') || '0') || 0,
      loop: element.getAttribute('data-loop') === 'true',
      phase: parseFloat(element.getAttribute('data-phase') || '0') || 0,
      rate: parseFloat(element.getAttribute('data-playback-rate') || '1') || 1,
      gain: Number(element.getAttribute('data-gain') ?? '1'),
      levelAutomation: JSON.parse(decodeURIComponent(element.getAttribute('data-level-automation') || '%7B%7D'))
    });
  }

  function scheduleEnvelope(param, points, sample, now) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(audioEnvelopeGainAt(points, sample), now);
    for (var point of points || []) {
      if (point.sample > sample) param.linearRampToValueAtTime(point.gain, now + (point.sample - sample) / 48000);
    }
  }

  // Each factor has its own GainNode so intersecting ramps multiply exactly.
  // These are the same absolute-sample envelopes consumed by the render mixer.
  function placeAudioGain(record, seconds) {
    if (!record.nodes) {
      var source = audioContext.createMediaElementSource(record.element);
      record.nodes = Array.from({ length: 5 }, function () { return audioContext.createGain(); });
      var previous = source;
      for (var node of record.nodes) { previous.connect(node); previous = node; }
      previous.connect(audioContext.destination);
      record.element.volume = 1;
    }
    var sample = seconds * 48000;
    var now = audioContext.currentTime;
    var p = record.levelAutomation;
    var start = p.mixStartSample ?? record.start * 48000;
    var end = p.mixEndSampleExclusive ?? (record.start + record.duration) * 48000;
    record.nodes[0].gain.setValueAtTime(record.gain, now);
    scheduleEnvelope(record.nodes[1].gain, p.gainEnvelope, sample, now);
    scheduleEnvelope(record.nodes[2].gain, p.fadeInSamples > 0
      ? [{ sample: start, gain: 0 }, { sample: start + p.fadeInSamples, gain: 1 }] : undefined, sample, now);
    scheduleEnvelope(record.nodes[3].gain, p.fadeOutSamples > 0
      ? [{ sample: end - p.fadeOutSamples, gain: 1 }, { sample: end, gain: 0 }] : undefined, sample, now);
    var gate = record.nodes[4].gain;
    gate.cancelScheduledValues(now);
    gate.setValueAtTime(p.audibility === undefined || p.audibility.some(function (span) {
      return sample >= span.startSample && sample < span.endSampleExclusive;
    }) ? 1 : 0, now);
    for (var span of p.audibility || []) {
      if (span.startSample > sample) gate.setValueAtTime(1, now + (span.startSample - sample) / 48000);
      if (span.endSampleExclusive > sample) gate.setValueAtTime(0, now + (span.endSampleExclusive - sample) / 48000);
    }
  }

  function seekDecoded(element, target) {
    if (Math.abs(element.currentTime - target) < 0.0005 && element.readyState >= 2) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = function () {
        element.removeEventListener('seeked', done);
        element.removeEventListener('error', done);
        resolve();
      };
      element.addEventListener('seeked', done, { once: true });
      element.addEventListener('error', done, { once: true });
      try { element.currentTime = target; }
      catch (error) { done(); }
    });
  }

  function placeHTML(frame) {
    if (!window.__qflowFrameProgram) return Promise.reject(new Error('HTML Program page ABI is missing'));
    return window.__qflowFrameProgram.applyFrame(frame);
  }

  function apply(seconds, scrubbing) {
    currentSeconds = Math.max(0, seconds);
    var revision = ++seekRevision;
    var waits = [];
    var programFrame = Math.max(0, Math.round(currentSeconds * fps));
    for (var record of media) {
      var inside = programFrame >= record.startFrame && programFrame < record.endFrame;
      var element = record.element;
      element.style.visibility = inside ? 'visible' : 'hidden';
      // Normalized picture Artifacts are deliberately silent. Program sound
      // comes from the exact AudioTrack below rather than from a video sidecar.
      element.muted = true;
      if (!inside) { element.pause(); continue; }
      // A hold remains one compact target interval. Its exact zero source rate
      // cannot be assigned to HTMLMediaElement.playbackRate, so keep the native
      // decoder paused at the authored source frame instead.
      if (record.sourceRate[0] === 0n) {
        var heldFrame = Number(record.sourceFrame[0] / record.sourceFrame[1]);
        var heldTarget = (heldFrame + 0.5) * record.sourceFps[1] / record.sourceFps[0];
        if (Number.isFinite(element.duration) && element.duration > 0) {
          heldTarget = Math.min(heldTarget, Math.max(0, element.duration - 0.001));
        }
        element.pause();
        waits.push(seekDecoded(element, heldTarget));
        continue;
      }
      var a = record.sourceFrame, r = record.sourceRate;
      var sourceFrame = Number((a[0] * r[1] + BigInt(programFrame - record.startFrame) * r[0] * a[1]) / (a[1] * r[1]));
      var target = (sourceFrame + 0.5) * record.sourceFps[1] / record.sourceFps[0];
      if (Number.isFinite(element.duration) && element.duration > 0) {
        target = Math.min(target, Math.max(0, element.duration - 0.001));
      }
      if (scrubbing || record.sourceRate[0] <= 0n || programFrame === record.endFrame - 1) {
        element.pause();
        waits.push(seekDecoded(element, target));
      } else {
        // During continuous playback the decoder owns its clock. A frame event
        // only corrects visible drift; making every refresh a media seek is what
        // previously froze the preview between frames.
        if (Math.abs(element.currentTime - target) > 0.08) element.currentTime = target;
        element.playbackRate = Number(record.sourceRate[0]) / Number(record.sourceRate[1]) * fps * record.sourceFps[1] / record.sourceFps[0];
        if (element.paused) {
          var started = element.play();
          if (started) started.catch(function () {});
        }
      }
    }
    for (var record of programAudio) {
      var local = currentSeconds - record.start;
      var inside = local >= 0 && local < record.duration;
      var element = record.element;
      element.muted = muted || scrubbing;
      if (!inside) { element.pause(); continue; }
      var interval = Math.max(0, record.mediaEnd - record.mediaStart);
      var advanced = (local + frameSeconds / 2) * record.rate;
      var target = record.mediaStart + advanced;
      if (record.loop && interval > 0) target = record.mediaStart + ((record.phase + advanced) % interval);
      else target = Math.min(target, Math.max(record.mediaStart, record.mediaEnd - 0.000001));
      if (scrubbing || local >= record.duration - frameSeconds - 0.000001) {
        element.pause();
        waits.push(seekDecoded(element, target));
      } else {
        if (Math.abs(element.currentTime - target) > 0.08) element.currentTime = target;
        element.playbackRate = record.rate;
        placeAudioGain(record, currentSeconds + frameSeconds / 2);
        if (element.paused) {
          var started = element.play();
          if (started) started.catch(function () {});
        }
      }
    }
    waits.push(placeHTML(programFrame));
    return Promise.all(waits).then(function () { return revision === seekRevision; });
  }

  window.__qflowSetMuted = function (value) {
    muted = !!value;
    return apply(currentSeconds, !playing);
  };
  window.__qflowSeekFrame = function (frame) {
    playing = false;
    return apply(frame / fps, true);
  };
  window.__qflowPlayFrame = function (frame) {
    playing = true;
    if (programAudio.length && !audioContext) audioContext = new AudioContext();
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    return apply(frame / fps, false);
  };
  window.__qflowFrameReady = apply(0, true);
  window.addEventListener('load', function () { window.__qflowFrameReady = apply(currentSeconds, true); });
})();
</script>`;
}

export function injectRuntimeShim(html: string, audio = ""): string {
  const script = audio + shim().replace("(function () {", `(function () {\n${audioEnvelopeGainAt.toString()}`);
  const at = html.lastIndexOf("</body>");
  return at < 0 ? html + script : html.slice(0, at) + script + html.slice(at);
}
