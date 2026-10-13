import { parseHTML } from "linkedom";
import type { Composition } from "@qflow/composition";
import { assertHtmlProgram, compileHtmlProgram, materializeHtmlProgram } from "@qflow/html-program";
import type { HtmlProgram, ResourceUrlResolver } from "@qflow/html-program";
import { compileAudioProgramPlan, verifyAudioProgramPlan } from "@qflow/media-operations";
import type { AudioProgramPlan } from "@qflow/media-operations";
import type { Timeline } from "@qflow/timeline";
import type { BlobRef } from "@qflow/qflow/protocol";
import { injectRuntimeShim } from "@qflow/html-program/playback";

export type HtmlDocument = {
  readonly format: "qflow.html-document@1";
  readonly program: HtmlProgram;
  readonly audio: AudioProgramPlan;
  readonly bindings: readonly { readonly id: string; readonly artifact: BlobRef }[];
};
export type HtmlDocumentPlaybackOptions = {
  readonly autoplay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  readonly responsive?: boolean;
};

export function compileHtmlDocument(composition: Composition, timeline: Timeline): HtmlDocument {
  const program = compileHtmlProgram(composition, timeline), audio = compileAudioProgramPlan(composition, timeline);
  const resources = new Map([...program.artifacts.map(entry => entry.artifact), ...audio.clips.map(clip => clip.artifact)].map(artifact => [artifact.resource, artifact]));
  return { format: "qflow.html-document@1", program, audio, bindings: [...resources].map(([id, artifact]) => ({ id, artifact })) };
}

// Result storage rebinds BlobRefs. Keep template-local identities independent of those addresses.
function boundProgram(document: HtmlDocument): HtmlProgram {
  if (!Array.isArray(document.bindings)) throw new Error("HTML document material bindings are required");
  const aliases = new Map(document.bindings.map(binding => [binding.artifact?.resource, binding.id]));
  const ids = new Set(document.bindings.map(binding => binding.id));
  if (ids.size !== document.bindings.length) throw new Error("HTML document repeats a material identity");
  const bind = (artifact: BlobRef): BlobRef => {
    const id = aliases.get(artifact.resource);
    if (id === undefined) throw new Error("HTML document material has no binding");
    return { ...artifact, resource: id as BlobRef["resource"] };
  };
  return { ...document.program,
    artifacts: document.program.artifacts.map(entry => ({ ...entry, artifact: bind(entry.artifact) })),
    surfaces: document.program.surfaces.map(surface => ({ ...surface, artifact: bind(surface.artifact) })),
  };
}

export function assertHtmlDocument(value: unknown): asserts value is HtmlDocument {
  if (value === null || typeof value !== "object" || (value as HtmlDocument).format !== "qflow.html-document@1") throw new Error("Unsupported HTML document format");
  const { program, audio } = value as HtmlDocument;
  assertHtmlProgram(boundProgram(value as HtmlDocument));
  verifyAudioProgramPlan(audio);
  if (program.frameCount !== audio.frameCount || program.frameRate.numerator !== audio.frameRate.numerator || program.frameRate.denominator !== audio.frameRate.denominator) throw new Error("HTML picture and sound must use the same frame clock");
}

const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Materialize picture and sound using the host's URLs and shared frame playback. */
function renderDocumentProgram(program: HtmlProgram, audio: AudioProgramPlan, resolve: ResourceUrlResolver): { html: string; preview: string } {
  assertHtmlProgram(program);
  verifyAudioProgramPlan(audio);
  const html = materializeHtmlProgram(program, resolve);
  const clips = audio.clips.map(clip => `<audio class="qflow-studio-audio" preload="auto"
    src="${attribute(resolve(clip.artifact))}"
    data-start="${clip.targetStartSample / 48_000}"
    data-duration="${(clip.targetEndSampleExclusive - clip.targetStartSample) / 48_000}"
    data-media-start="${clip.sourceStartSample / 48_000}"
    data-media-end="${clip.sourceEndSampleExclusive / 48_000}"
    data-loop="${clip.sourceLoop}" data-phase="${clip.sourcePhaseSample / 48_000}"
    data-playback-rate="${clip.playbackRate}" data-gain="${clip.gain}"
    data-level-automation="${encodeURIComponent(JSON.stringify({ gainEnvelope: clip.gainEnvelope, audibility: clip.audibility, fadeInSamples: clip.fadeInSamples, fadeOutSamples: clip.fadeOutSamples, mixStartSample: clip.mixStartSample, mixEndSampleExclusive: clip.mixEndSampleExclusive }))}"></audio>`).join("");
  return { html, preview: injectRuntimeShim(html, clips) };
}

/** Produce a browser page. Hosts resolve material to HTTP, relative or embedded URLs. */
export function materializeHtmlDocument(document: HtmlDocument, resolve: ResourceUrlResolver, options: HtmlDocumentPlaybackOptions = {}): string {
  assertHtmlDocument(document);
  const program = boundProgram(document), audio = document.audio;
  const materials = new Map(document.bindings.map(binding => [binding.id, binding.artifact]));
  const rendered = renderDocumentProgram(program, audio, artifact => resolve(materials.get(artifact.resource) ?? artifact)).preview;
  const { document: page } = parseHTML(rendered);
  const scripts = Array.from(page.querySelectorAll("script")).map(script => {
    const source = script.textContent ?? "";
    script.remove();
    return source;
  });
  const html = page.toString();
  const settings = JSON.stringify({ autoplay: options.autoplay ?? true, loop: options.loop ?? true, muted: options.muted ?? true, responsive: options.responsive ?? true });
  const driver = `<script>
(() => {
  const options = ${settings}, count = ${program.frameCount}, fps = ${program.frameRate.numerator}/${program.frameRate.denominator};
  let frame = 0, playing = false, request, generation = 0, started, lastReport = 0;
  function report(force = false) {
    if (window.parent === window) return;
    const now = performance.now();
    if (!force && now - lastReport < 100) return;
    lastReport = now;
    window.parent.postMessage({type:'qflow.html-document.state@1',frame,frameCount:count,frameRate:fps,playing}, '*');
  }
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  function pause() {
    playing = false; generation++; cancelAnimationFrame(request);
    return ready.then(async () => { await window.__qflowSeekFrame(frame); report(true); });
  }
  async function play() {
    await ready;
    if (playing) return;
    playing = true; started = performance.now() - frame * 1000 / fps;
    report(true);
    const current = ++generation;
    async function tick(now) {
      if (!playing || generation !== current) return;
      const elapsed = Math.floor((now - started) * fps / 1000);
      frame = options.loop ? elapsed % count : Math.min(elapsed, count - 1);
      try { await window.__qflowPlayFrame(frame); }
      catch (error) { playing = false; window.dispatchEvent(new CustomEvent('qflow-playback-error', {detail: error})); return; }
      if (!playing || generation !== current) return;
      report();
      if (!options.loop && elapsed >= count - 1) { await pause(); return; }
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
  }
  window.__qflowDocument = {
    ready, play, pause,
    get frame() { return frame; }, get playing() { return playing; },
    async seekFrame(value) {
      if (!Number.isSafeInteger(value) || value < 0 || value >= count) throw new RangeError('Frame outside HTML document');
      await pause(); frame = value; await window.__qflowSeekFrame(frame); report(true);
    },
    async setMuted(value) { await ready; await window.__qflowSetMuted(value); }
  };
  let commands = Promise.resolve();
  window.addEventListener('message', event => {
    if (event.source !== window.parent || window.parent === window || event.data?.type !== 'qflow.html-document.command@1') return;
    const {action,frame:target,muted} = event.data;
    commands = commands.then(async () => {
      await ready;
      if (action === 'play') await play();
      else if (action === 'pause') await pause();
      else if (action === 'seek') await window.__qflowDocument.seekFrame(target);
      else if (action === 'mute') await window.__qflowDocument.setMuted(muted);
      else if (action === 'state') report(true);
    }).catch(error => window.parent.postMessage({type:'qflow.html-document.error@1',message:String(error)}, '*'));
  });
  window.addEventListener('load', async () => {
    try {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
      ${scripts.join("\n")}
      await window.__qflowFrameProgram.prepare();
      await window.__qflowFrameReady;
      await window.__qflowSetMuted(options.muted);
      if (options.responsive) {
        const root = document.querySelector('[data-qflow-program-root]');
        function resize() {
          const scale = Math.min(innerWidth/${program.canvas.width}, innerHeight/${program.canvas.height});
          Object.assign(root.style, {position:'absolute', transformOrigin:'top left', transform:'scale('+scale+')', left:((innerWidth-${program.canvas.width}*scale)/2)+'px', top:((innerHeight-${program.canvas.height}*scale)/2)+'px'});
        }
        new ResizeObserver(resize).observe(document.documentElement); resize();
      }
      readyResolve();
      report(true);
      if (options.autoplay) await play();
    } catch (error) { readyReject(error); }
  }, {once:true});
})();
</script>`;
  return html.replace("</body>", driver + "</body>");
}
