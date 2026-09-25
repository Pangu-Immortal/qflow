/** Page-private Present visibility. The shared index owns only interval lookup. */
export function presentationVisibilityScript(numerator: number, denominator: number): string {
  return `(() => {
    const entries = [...document.querySelectorAll('[data-qflow-visibility]')].map((element, order) => ({
      element,
      order,
      spans: JSON.parse(element.dataset.qflowVisibility),
    }));
    const workIndex = hyperframesCreateFrameWorkIndex(entries.flatMap(entry => entry.spans
      .filter(span => hyperframesSelectionOverlaps(span.startFrame, span.endFrameExclusive)).map(span => ({
      startFrame: span.startFrame,
      endFrameExclusive: span.endFrameExclusive,
      order: entry.order,
      payload: entry.element,
    }))));
    let visible = new Set();
    for (const entry of entries) entry.element.style.opacity = '0';
    const apply = time => {
      const frame = Math.max(0, Math.round(Number(time || 0) * ${numerator} / ${denominator}));
      const next = new Set(workIndex.at(frame).map(work => work.payload));
      // A presentation mask controls painting, not layout or animation existence.
      // Only roots whose absolute visibility changed need a DOM write.
      for (const element of visible) if (!next.has(element)) element.style.opacity = '0';
      for (const element of next) if (!visible.has(element)) element.style.opacity = '';
      visible = next;
    };
    apply(0);
    window.addEventListener('hf-seek', event => apply(event.detail?.time));
  })();`;
}
