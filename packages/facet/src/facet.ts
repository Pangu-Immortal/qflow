/** One package contribution understood only by the owner of its exact ABI. */
export type Facet = {
  readonly abi: string;
  readonly offers?: readonly string[];
  readonly implementation: unknown;
};
