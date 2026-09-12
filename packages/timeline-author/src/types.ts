import type { SemanticTake } from "@qflow/speech";
export type TimelineAuthorHeader = { readonly id: string; readonly at?: readonly string[]; readonly end?: string };
export type TimelineAuthorTake = { readonly semantic: SemanticTake };
export type TimelineAuthorSet = { readonly takes: readonly TimelineAuthorTake[] };
export type TimelineAuthorInput = { readonly takeName: string };
export type TimelineAuthorFragmentOptions = { readonly takes: readonly TimelineAuthorInput[] };
