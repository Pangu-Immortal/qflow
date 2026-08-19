/**
 * The official video packages understood by this preview application.
 *
 * This is deliberately application-local composition. Qflow packages do
 * not register themselves with a central video catalogue and do not know that
 * the Playground exists. The Playground chooses the packages it previews,
 * then reads the activation each package already publishes for normal Hosts.
 */
import { registerProducerFacets, registerTypeValidatorFacets } from "@qflow/component-kit";
import { createResolvedClosure } from "@qflow/core";
import { ProducerRegistry } from "@qflow/driver-node";
import {
  AuthorFrontendRegistry,
  installAuthorFrontendHostFacets,
} from "@qflow/elaborator";
import {
  createMarkupAuthorFrontend,
  installMarkupSurfaceHostFacets,
  MarkupSurfaceRegistry,
} from "@qflow/markup";
import type { MarkupSurfaceRegistryLike } from "@qflow/markup";
import { loadNodePackageSelection } from "@qflow/package-loader-node";
import type { ModuleRef, ResolvedModuleClosure } from "@qflow/protocol";
import { TypeValidatorRegistry } from "@qflow/validation";

const OFFICIAL_VIDEO_PACKAGES = [
  "@qflow/audio-track",
  "@qflow/background-removal",
  "@qflow/caption",
  "@qflow/caption-fine",
  "@qflow/caption-gemini",
  "@qflow/comment-sticker",
  "@qflow/deck-track",
  "@qflow/estimate",
  "@qflow/film",
  "@qflow/fonts-open",
  "@qflow/gemini-omni",
  "@qflow/gpt-image",
  "@qflow/grok-imagine",
  "@qflow/image-compose",
  "@qflow/image-transform",
  "@qflow/media",
  "@qflow/media-pipeline",
  "@qflow/media-track",
  "@qflow/mimo-tts",
  "@qflow/minimax-h3",
  "@qflow/nano-banana",
  "@qflow/ranking",
  "@qflow/render-hyperframes",
  "@qflow/screen-overlay",
  "@qflow/script",
  "@qflow/seedance",
  "@qflow/seedream",
  "@qflow/spatial",
  "@qflow/speech-spine",
  "@qflow/svs",
  "@qflow/text",
  "@qflow/typography-track",
  "@qflow/whisperx",
] as const;

/**
 * Packages a previewed Source declares that the official list does not carry,
 * and the directory they are installed under.
 *
 * A Source is free to import a package this application has never heard of —
 * a project-local component is the normal case, not an exception — so the
 * preview loads what the Source actually names in addition to the official
 * list, resolved from the project rather than from this application.
 */
let projectPackages: readonly string[] = [];
let projectRoot: string | undefined;

export function usePreviewPackages(packages: readonly string[], root: string): void {
  if (loading !== undefined) throw new Error("Preview packages must be chosen before the first Source is compiled.");
  projectPackages = packages;
  projectRoot = root;
}

/** The package specifiers a Source imports, with any logical version suffix removed. */
export function importedPackages(source: string): readonly string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/<import\b[^>]*\bfrom\s*=\s*"([^"]+)"/gu)) {
    const specifier = match[1]!;
    const suffix = specifier.lastIndexOf("@");
    found.add(suffix > 0 && /^\d+$/u.test(specifier.slice(suffix + 1)) ? specifier.slice(0, suffix) : specifier);
  }
  return [...found];
}

type OfficialVideoDomain = {
  readonly closure: ResolvedModuleClosure;
  readonly surfaces: MarkupSurfaceRegistry;
  readonly producers: ProducerRegistry;
  readonly validators: TypeValidatorRegistry;
  readonly resolveModule: (specifier: string) => ModuleRef | undefined;
  readonly frontends: (surfaces?: MarkupSurfaceRegistryLike) => AuthorFrontendRegistry;
};

let loading: Promise<OfficialVideoDomain> | undefined;

async function loadOfficialVideoDomain(): Promise<OfficialVideoDomain> {
  const selection = [...new Set([...OFFICIAL_VIDEO_PACKAGES, ...projectPackages])];
  const loaded = await loadNodePackageSelection(selection, projectRoot ?? import.meta.dirname);
  const contributions = loaded.map((item) => item.contribution);
  const manifests = contributions.flatMap((item) =>
    (item.modules ?? []).map((module) => module.manifest));
  const closure = createResolvedClosure(manifests);

  const modules = new Map<string, ModuleRef>();
  for (const contribution of contributions) {
    for (const module of contribution.modules ?? []) {
      const ref = { name: module.manifest.name, version: module.manifest.version };
      for (const specifier of [
        module.manifest.name,
        `${module.manifest.name}@${module.manifest.version}`,
        ...(module.specifiers ?? []),
      ]) modules.set(specifier, ref);
    }
  }
  const resolveModule = (specifier: string): ModuleRef | undefined => modules.get(specifier);

  const facets = contributions.flatMap((item) => item.hostFacets ?? []);
  const surfaces = new MarkupSurfaceRegistry();
  installMarkupSurfaceHostFacets(facets, surfaces);

  const components = contributions.flatMap((item) => item.components ?? []);
  const producers = new ProducerRegistry();
  const validators = new TypeValidatorRegistry();
  for (const component of components) {
    registerProducerFacets(producers, component.producers ?? []);
    registerTypeValidatorFacets(validators, component.validators ?? []);
  }

  return {
    closure,
    surfaces,
    producers,
    validators,
    resolveModule,
    frontends(registry = surfaces) {
      const frontends = new AuthorFrontendRegistry();
      frontends.register(createMarkupAuthorFrontend({
        registry,
        resolveModule(request) {
          const found = resolveModule(request.from);
          if (found === undefined) throw new Error(`No package installed under the previewed project declares ${request.from}.`);
          return found;
        },
      }));
      installAuthorFrontendHostFacets(facets, frontends);
      return frontends;
    },
  };
}

/** Load the preview application's package composition once per process. */
export async function officialVideoDomain(): Promise<OfficialVideoDomain> {
  loading ??= loadOfficialVideoDomain();
  return await loading;
}
