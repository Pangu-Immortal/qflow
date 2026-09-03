# `@qflow/provider-vertex`

Vertex Gemini Runtime Provider and embedded backend for callers that need text, image or video input.
It fulfills the same provider-neutral `@qflow/gemini` capabilities as QflowHub, so Runtime Profiles
choose the backend without changing Author Source. The package owns the Google GenAI client and
credential parsing.

```ts
import { createVertexGeminiGenerator } from "@qflow/provider-vertex";

const generate = createVertexGeminiGenerator({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!,
  model: "gemini-3.7-flash-openai",
});
```
