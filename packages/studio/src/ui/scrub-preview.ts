import { uiAttr, uiText, t } from "./i18n.js";
import type { StudioSnapshot } from "../shared.js";
import { feedbackClock } from "../feedback.js";

type PreviewWindow = Window & {
  __qflowSeekFrame?: (frame: number) => Promise<boolean>;
  __qflowSetMuted?: (muted: boolean) => Promise<boolean>;
};

/** One lazy, muted picture for scrubbing; it never changes the main playhead. */
export function createScrubPreview(container: HTMLElement) {
  const element = document.createElement("div");
  element.className = "scrub-preview";
  element.hidden = true;
  element.innerHTML = '<div class="scrub-preview-picture"><span></span></div><div class="scrub-preview-time"></div>';
  element.setAttribute("aria-hidden", "true");
  const picture = element.querySelector<HTMLElement>(".scrub-preview-picture")!;
  const status = picture.querySelector<HTMLElement>("span")!;
  uiText(status, "player.frame-loading");
  const time = element.querySelector<HTMLElement>(".scrub-preview-time")!;
  container.append(element);
  let iframe: HTMLIFrameElement | undefined;
  let revision: number | undefined;
  let ready = false;
  let seeking = false;
  let requested: number | undefined;
  let displayed: number | undefined;

  const seek = async (): Promise<void> => {
    const current = iframe;
    if (!ready || seeking || current === undefined || requested === undefined || requested === displayed) return;
    seeking = true;
    try {
      while (iframe === current && requested !== undefined && requested !== displayed) {
        const frame: number = requested;
        const target = current.contentWindow as PreviewWindow | null;
        const placed = await target?.__qflowSeekFrame?.(frame);
        if (iframe !== current) return;
        if (!placed) throw new Error(t("player.frame-unavailable"));
        displayed = frame;
        if (requested === frame) {
          current.style.visibility = "visible";
          status.hidden = true;
          element.dataset.frame = String(frame);
        }
      }
    } catch {
      if (iframe === current) uiText(status, "player.frame-unavailable");
    } finally {
      if (iframe === current) seeking = false;
    }
  };
  const hide = (): void => { element.hidden = true; requested = undefined; };
  const clear = (): void => {
    hide(); iframe?.remove(); iframe = undefined; revision = undefined;
    ready = false; seeking = false; displayed = undefined;
    delete element.dataset.frame;
  };
  return {
    hide, clear,
    show(snapshot: StudioSnapshot, frame: number, clientX: number): void {
      if (snapshot.revision !== revision) clear();
      if (iframe === undefined) {
        revision = snapshot.revision;
        const { width: canvasWidth, height: canvasHeight } = snapshot.canvas;
        const scale = Math.min(200 / canvasWidth, 170 / canvasHeight);
        picture.style.width = `${canvasWidth * scale}px`;
        picture.style.height = `${canvasHeight * scale}px`;
        const created = document.createElement("iframe");
        uiAttr(created, "title", "player.hovered-frame");
        created.tabIndex = -1;
        created.setAttribute("sandbox", "allow-scripts allow-same-origin");
        created.setAttribute("allow", "autoplay 'none'");
        created.style.width = `${canvasWidth}px`;
        created.style.height = `${canvasHeight}px`;
        created.style.transform = `scale(${scale})`;
        created.style.visibility = "hidden";
        created.addEventListener("load", () => {
          void (async () => {
            const target = created.contentWindow as PreviewWindow | null;
            await target?.__qflowSetMuted?.(true);
            if (iframe !== created) return;
            ready = true;
            await seek();
          })().catch(() => { if (iframe === created) uiText(status, "player.frame-unavailable"); });
        });
        created.srcdoc = snapshot.preview.srcdoc;
        iframe = created;
        picture.prepend(created);
      }
      requested = frame;
      element.hidden = false;
      const room = container.getBoundingClientRect();
      const left = Math.max(0, Math.min(clientX - room.left - element.offsetWidth / 2, room.width - element.offsetWidth));
      element.style.left = `${left}px`;
      time.textContent = feedbackClock(frame * snapshot.timeline.frameRate.denominator / snapshot.timeline.frameRate.numerator);
      if (frame !== displayed) {
        iframe.style.visibility = "hidden";
        uiText(status, "player.frame-loading");
        status.hidden = false;
        delete element.dataset.frame;
      } else {
        iframe.style.visibility = "visible";
        status.hidden = true;
        element.dataset.frame = String(frame);
      }
      void seek();
    },
  };
}
