import { createTemporalInstantConstruction, createTemporalWindowConstruction, temporalInstantAttributeNames, temporalWindowAttributeNames } from "@qflow/qflow/temporal-markup";

/** The fixture intentionally exposes both projection helpers and their vocabularies. */
export { temporalInstantAttributeNames, temporalWindowAttributeNames };
export const projectExampleWindow = createTemporalWindowConstruction;
export const projectExampleMoment = createTemporalInstantConstruction;
