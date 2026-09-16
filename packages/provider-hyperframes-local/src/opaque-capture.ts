import type { CaptureSession, HfProtocol } from "@hyperframes/engine";
import { getCdpSession } from "@hyperframes/engine";

/** The optional completion hooks supplied by the pinned Hyperframes page runtime. */
type RenderWindow = Window & {
  __hf: HfProtocol & { colorGrading?: { waitForActiveLuts?: () => Promise<void> } };
  __hfWaitForSeekCompletion?: () => Promise<void>;
  __hf_page_composite_pending?: boolean;
  __hf_page_composite_prepare?: () => Promise<void>;
  __hf_page_composite_resolve?: () => void;
  __qflowBrowserProgramError?: string;
};

/**
 * A screenshot adapter for this Provider's opaque MP4 output. Session lifecycle,
 * the page's seek protocol and the video injector remain engine-owned. Encoding
 * the already-composited frame as a fast PNG does not change source alpha.
 * No engine/session methods are replaced and no installed dependency is patched.
 */
export async function createOpaqueFrameCapture(session: CaptureSession) {
  const { page, options } = session;
  const cdp = await getCdpSession(page);
  // MP4 has no alpha channel. The authored Canvas paints over this final matte.
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 1 } });
  // Image readiness belongs to this page. A seek can select a new image through
  // attributes, a CSS class or a pseudo-element after initial page readiness.
  await page.evaluate(() => {
    const decoded = new Map<string, Promise<void>>();
    const images = {
      load(url: string): Promise<void> {
        let ready = decoded.get(url);
        if (ready === undefined) {
          const image = new Image();
          image.src = url;
          ready = image.decode().catch(error => {
            throw new Error(`HyperFrames image could not be decoded: ${url}`, { cause: error });
          });
          decoded.set(url, ready);
        }
        return ready;
      },
      background(value: string, pending: Promise<unknown>[]) {
        for (const match of value.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s"'()]+))\s*\)/gu)) {
          const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
          if (url) pending.push(this.load(url));
        }
      },
      style(style: CSSStyleDeclaration, pending: Promise<unknown>[]) {
        for (const value of [style.backgroundImage, style.maskImage, style.borderImageSource, style.listStyleImage, style.content]) {
          this.background(value, pending);
        }
      },
    };
    (window as unknown as { __qflowPrepareImages: () => Promise<void> }).__qflowPrepareImages = async () => {
      const pending: Promise<unknown>[] = [];
      for (const image of Array.from(document.images)) {
        if ((image.currentSrc || image.getAttribute("src") || image.getAttribute("srcset"))
          && (!image.complete || image.naturalWidth === 0)) {
          pending.push(image.decode().catch(error => {
            throw new Error(`HyperFrames image could not be decoded: ${image.currentSrc || image.src}`, { cause: error });
          }));
        }
      }
      for (const element of Array.from(document.querySelectorAll("*"))) {
        images.style(getComputedStyle(element), pending);
        for (const pseudo of ["::before", "::after"]) {
          const style = getComputedStyle(element, pseudo);
          if (style.content !== "none" && style.content !== "normal") images.style(style, pending);
        }
      }
      for (const image of Array.from(document.querySelectorAll("svg image"))) {
        const href = image.getAttribute("href") ?? image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href) pending.push(images.load(new URL(href, document.baseURI).href));
      }
      await Promise.all(pending);
      await document.fonts.ready;
      document.fonts.forEach(font => {
        if (font.status === "error") throw new Error(`HyperFrames font could not be loaded: ${font.family}`);
      });
    };
  });
  return async (frame: number) => {
    const time = frame * options.fps.den / options.fps.num;
    const start = performance.now();
    await page.evaluate(async t => {
      const w = window as unknown as RenderWindow;
      await w.__hf.seek(t);
    }, time);
    const sought = performance.now();
    await session.onBeforeCapture?.(page, time);
    const composite = await page.evaluate(async () => {
      const w = window as unknown as RenderWindow & { __qflowPrepareImages: () => Promise<void> };
      await w.__hfWaitForSeekCompletion?.();
      await w.__hf.colorGrading?.waitForActiveLuts?.();
      await w.__qflowPrepareImages();
      if (w.__qflowBrowserProgramError !== undefined) throw new Error(w.__qflowBrowserProgramError);
      if (w.__hf_page_composite_pending) {
        await w.__hf_page_composite_prepare?.();
        return true;
      }
      return false;
    });
    if (composite) {
      // The runtime's shader compositor needs a paint between preparing its DOM
      // layers and resolving them. A 1 px capture flushes Chrome's compositor.
      await cdp.send("Page.captureScreenshot", {
        format: "jpeg", quality: 1, clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 },
      });
      await page.evaluate(() => (window as unknown as RenderWindow).__hf_page_composite_resolve?.());
    }
    const prepared = performance.now();
    const result = await cdp.send("Page.captureScreenshot", {
      format: "png", optimizeForSpeed: true, fromSurface: true,
      captureBeyondViewport: options.captureBeyondViewport ?? false,
      clip: { x: 0, y: 0, width: options.width, height: options.height, scale: options.deviceScaleFactor ?? 1 },
    });
    return { buffer: Buffer.from(result.data, "base64"),
      seekMs: sought - start, prepareMs: prepared - sought, screenshotMs: performance.now() - prepared };
  };
}
