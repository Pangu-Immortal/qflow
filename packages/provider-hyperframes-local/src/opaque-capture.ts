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
  __qflowCaptureRoots?: readonly Element[];
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
    const dirtyRoots = new Set<Element>();
    const animatedRoots = new Set<Element>();
    const inspectedAnimations = new WeakSet<Animation>();
    const pendingSheetChanges = new Set<Promise<unknown>>();
    const announcedRoots = (window as unknown as RenderWindow).__qflowCaptureRoots;
    const captureRoots = Array.isArray(announcedRoots)
      && announcedRoots.every(root => root instanceof Element) ? [...announcedRoots] : null;
    const images = {
      load(url: string): Promise<void> {
        const absolute = new URL(url, document.baseURI).href;
        let ready = decoded.get(absolute);
        if (ready === undefined) {
          const image = new Image();
          image.src = absolute;
          ready = image.decode().catch(error => {
            throw new Error(`HyperFrames image could not be decoded: ${absolute}`, { cause: error });
          });
          decoded.set(absolute, ready);
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
      inlineSignature(value: string): string {
        const style = document.createElement("span").style;
        style.cssText = value;
        const candidates = [style.backgroundImage, style.maskImage, style.borderImageSource, style.listStyleImage, style.content];
        for (let index = 0; index < style.length; index += 1) {
          const name = style.item(index);
          if (name.startsWith("--")) candidates.push(style.getPropertyValue(name));
        }
        return candidates.filter(candidate => /url\(|image-set\(|cross-fade\(|var\(/iu.test(candidate)).join("\n");
      },
    };
    const readiness = {
      markDirty(node: Node | null): void {
        if (node === document) {
          // A real global stylesheet edit has opaque whole-document reach.
          // This is the explicit escape hatch, not the initial scoped path.
          if (document.documentElement !== null) dirtyRoots.add(document.documentElement);
          return;
        }
        if (!(node instanceof Element)) return;
        if (captureRoots === null) {
          dirtyRoots.add(node);
          return;
        }
        for (const root of captureRoots) {
          if (root === node || root.contains(node)) {
            dirtyRoots.add(node);
            return;
          }
          if (node.contains(root)) dirtyRoots.add(root);
        }
      },
      markAnimatedImageRoots(): void {
        for (const animation of document.getAnimations()) {
          if (inspectedAnimations.has(animation)) continue;
          inspectedAnimations.add(animation);
          const effect = animation.effect;
          if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) continue;
          const changesImage = effect.getKeyframes().some(keyframe => Object.entries(keyframe).some(([name, value]) =>
            name !== "easing" && typeof value === "string" && /url\(|image-set\(|cross-fade\(|var\(/iu.test(value)));
          if (changesImage) animatedRoots.add(effect.target);
        }
        // Browser animation state can change without a DOM mutation. Only those
        // targets whose keyframes can select an image remain frame-active.
        for (const root of animatedRoots) {
          if (root.isConnected) this.markDirty(root);
          else animatedRoots.delete(root);
        }
      },
      rootsForPass(): Element[] {
        const roots = [...dirtyRoots].filter(root => root.isConnected);
        dirtyRoots.clear();
        // Do not scan a nested dirty subtree when an ancestor is already dirty.
        return roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
      },
      appendElementImages(element: Element, pending: Promise<unknown>[]): void {
        if (element instanceof HTMLImageElement
          && (element.currentSrc || element.getAttribute("src") || element.getAttribute("srcset"))
          && (!element.complete || element.naturalWidth === 0)) {
          pending.push(element.decode().catch(error => {
            throw new Error(`HyperFrames image could not be decoded: ${element.currentSrc || element.src}`, { cause: error });
          }));
        }
        images.style(getComputedStyle(element), pending);
        for (const pseudo of ["::before", "::after"]) {
          const style = getComputedStyle(element, pseudo);
          if (style.content !== "none" && style.content !== "normal") images.style(style, pending);
        }
        if (element instanceof SVGImageElement) {
          const href = element.getAttribute("href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
          if (href) pending.push(images.load(href));
        }
      },
      async preparePass(): Promise<void> {
        if (pendingSheetChanges.size > 0) await Promise.all([...pendingSheetChanges]);
        this.markAnimatedImageRoots();
        const pending: Promise<unknown>[] = [];
        for (const root of this.rootsForPass()) {
          this.appendElementImages(root, pending);
          for (const element of Array.from(root.querySelectorAll("*"))) this.appendElementImages(element, pending);
        }
        await Promise.all(pending);
      },
    };
    // CSSOM edits have no DOM mutation record and can change image selection
    // anywhere in the document. Keep this as the explicit opaque-page fallback:
    // only an actual global stylesheet edit dirties the complete page.
    const sheetPrototype = CSSStyleSheet.prototype;
    const originalInsertRule = sheetPrototype.insertRule;
    const originalDeleteRule = sheetPrototype.deleteRule;
    const originalReplace = sheetPrototype.replace;
    const originalReplaceSync = sheetPrototype.replaceSync;
    const sheetEdits = {
      insertRule(this: CSSStyleSheet, rule: string, index?: number): number {
        const result = Reflect.apply(originalInsertRule, this, index === undefined ? [rule] : [rule, index]) as number;
        readiness.markDirty(document);
        return result;
      },
      deleteRule(this: CSSStyleSheet, index: number): void {
        Reflect.apply(originalDeleteRule, this, [index]);
        readiness.markDirty(document);
      },
      replace(this: CSSStyleSheet, text: string): Promise<CSSStyleSheet> {
        const result = Reflect.apply(originalReplace, this, [text]) as Promise<CSSStyleSheet>;
        const pending = result.then(sheet => {
          readiness.markDirty(document);
          return sheet;
        });
        pendingSheetChanges.add(pending);
        void pending.then(() => pendingSheetChanges.delete(pending), () => pendingSheetChanges.delete(pending));
        return result;
      },
      replaceSync(this: CSSStyleSheet, text: string): void {
        Reflect.apply(originalReplaceSync, this, [text]);
        readiness.markDirty(document);
      },
    };
    sheetPrototype.insertRule = sheetEdits.insertRule;
    sheetPrototype.deleteRule = sheetEdits.deleteRule;
    sheetPrototype.replace = sheetEdits.replace;
    sheetPrototype.replaceSync = sheetEdits.replaceSync;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "childList") {
          // New subtrees can own resources. The parent itself can gain a
          // :empty/:has-driven pseudo image, but unchanged siblings do not need
          // to be rediscovered for the ordinary insertion case.
          const added = Array.from(record.addedNodes);
          const changesStylesheet = (record.target instanceof Element
            && (record.target.tagName === "STYLE" || record.target.tagName === "LINK"))
            || added.some(node => node instanceof Element && (node.tagName === "STYLE" || node.tagName === "LINK"));
          readiness.markDirty(changesStylesheet ? document : record.target);
          for (const node of added) readiness.markDirty(node);
          continue;
        }
        if (record.type === "characterData") {
          const parent = record.target.parentElement;
          // A changed <style> can affect any existing element.
          readiness.markDirty(parent?.tagName === "STYLE" ? document : parent);
          continue;
        }
        const target = record.target;
        if (!(target instanceof Element)) continue;
        const name = record.attributeName ?? "";
        if (target.tagName === "STYLE" || target.tagName === "LINK") {
          readiness.markDirty(document);
        } else if (name === "style") {
          // Layout/visibility writes are common during every seek and cannot
          // introduce a resource. Resource-bearing declarations and custom
          // properties may affect this complete subtree.
          if (images.inlineSignature(record.oldValue ?? "") !== images.inlineSignature(target.getAttribute("style") ?? "")) {
            readiness.markDirty(target);
          }
        } else {
          // class/id/arbitrary data attributes can select descendant and pseudo
          // styles; src/srcset/href also arrive here.
          readiness.markDirty(target);
        }
      }
    });
    if (document.documentElement !== null) {
      if (captureRoots === null) dirtyRoots.add(document.documentElement);
      else for (const root of captureRoots) if (root.isConnected) dirtyRoots.add(root);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeOldValue: true,
      });
    }
    (window as unknown as { __qflowPrepareImages: () => Promise<void> }).__qflowPrepareImages = async () => {
      // MutationObserver delivery and Promise continuations are microtasks. A
      // pass may itself allow a waiting program to publish another subtree, so
      // drain until the page has no newly dirtied resource scope.
      await Promise.resolve();
      do await readiness.preparePass(); while (dirtyRoots.size > 0);
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
