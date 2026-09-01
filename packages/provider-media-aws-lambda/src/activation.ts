import {
  createRuntimeEndpointAdapterFacet,
} from "@qflow/runtime-kit";

const awsLambdaMediaRuntimeAdapter = createRuntimeEndpointAdapterFacet({
  use: "@qflow/provider-media-aws-lambda",
  activate(_context) {
    throw new Error(
      "@qflow/provider-media-aws-lambda is retired: it depended on a Runtime-wide shared S3 ArtifactStore."
      + " Use a Provider that owns its remote transport and imports completed resources into the Build working store.",
    );
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [awsLambdaMediaRuntimeAdapter],
};

export default qflowPackage;
