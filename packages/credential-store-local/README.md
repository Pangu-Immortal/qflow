# `@qflow/credential-store-local`

The writable CredentialStore for the machine running Qflow. It owns references filed under
`{ store: "local", key }`.

By default it uses macOS Keychain or Windows Credential Locker on those systems, and owner-private
files on Linux. These are implementation strategies of one local Store, not separate Runtime
components.

```json
{
  "credentials": {
    "local": { "use": "@qflow/credential-store-local" }
  }
}
```

Select the file backend explicitly when a system locker is unsuitable, including Windows secrets
that exceed Credential Locker's 512-character password limit:

```json
{
  "credentials": {
    "local": {
      "use": "@qflow/credential-store-local",
      "config": { "backend": "file", "path": "credentials" }
    }
  }
}
```

`path` is resolved below the Qflow host state root. The directory and documents must be private to
their owner. `service` optionally changes the macOS/Windows locker service name. Setting
`backend: "system"` requires macOS or Windows and fails instead of silently switching storage.

Use `@qflow/credential-store-env` when the deployment environment, rather than Qflow, owns a
read-only secret.
