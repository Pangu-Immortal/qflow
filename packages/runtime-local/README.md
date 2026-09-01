# `@qflow/runtime-local`

The default local Runtime for Qflow. It owns the Worker, scheduler, active SQLite execution state
and Build queue. Project-owned Build Results hold terminal public Outputs.

A Runtime Profile selects only the environmental parts that genuinely vary:

```json
{
  "format": "qflow.runtime-profile@1",
  "runtime": {
    "use": "@qflow/runtime-local",
    "config": {
      "dataRoot": ".qflow/runtimes/local",
      "credentials": {
        "env": { "use": "@qflow/credential-store-env" }
      },
      "endpoints": {}
    }
  }
}
```

Submitting a Build stores it and returns. The local Worker advances several Builds concurrently while
sharing the configured command limit. Endpoint packages declare their own Provider and model limits.
Cancellation prevents new work and makes a best effort to cancel an external operation already submitted;
completed output is never rolled back.

The Profile does not select Build or Artifact history stores. Runtime working bytes are internal and
Build-local. After a Result is terminal, history is read from `.qflow/results`, not Runtime SQLite.

Source imports select author packages. Runtime Profile entries select only code allowed to access files,
credentials, processes or networks. Installing a package changes neither selection.
