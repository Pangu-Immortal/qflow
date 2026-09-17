# `@qflow/credential-store-file`

A writable CredentialStore for a deployment that explicitly chooses local file storage, including
Linux without an OS credential locker. It stores unencrypted credential values in an owner-private
directory outside the video project. On Windows the selected directory must have a private user ACL;
POSIX file modes do not set Windows ACLs. Choose `@qflow/credential-store-os` when using macOS Keychain
or Windows Credential Locker, `@qflow/credential-store-platform` for OS storage on macOS/Windows
and this file Store on Linux or `@qflow/credential-store-env` for externally
supplied, read-only values.

## Select it before login

After `qflow runtime init`, edit the created Profile before running `auth` or starting its Runtime.
Replace its credential-store selection and the chosen Endpoint's credential reference together:

```json
{
  "credentials": {
    "file": { "use": "@qflow/credential-store-file" }
  },
  "endpoints": {
    "qflowhub.default": {
      "use": "@qflow/provider-qflowhub",
      "config": {
        "baseUrl": "https://qflow.ai",
        "apiKey": { "store": "file", "key": "qflowhub.oauth" }
      }
    }
  }
}
```

This is a Profile fragment: preserve its format, dataRoot, other Endpoints and bindings. For an
existing Profile, edit only the selected references and use `qflow runtime use <profile>` to select it.
The Endpoint still owns its acquisition flow; the Store only persists its result:

```bash
qflow auth login qflowhub.default
qflow auth status qflowhub.default
qflow auth logout qflowhub.default
```

No existing OS credential is migrated and no failed lookup tries another Store. A damaged document
can be replaced by login or deleted by logout without decoding the old value. Status and execution
report the read error rather than treating corruption as a missing credential.

## Storage

The default directory is `credentials` under the Host state root printed by `qflow paths`.
`config.path` explicitly selects a directory, including an absolute directory outside that root;
relative paths resolve against the Host root.
Opening the adapter and reading an absent key do not create files. Keep this directory outside Git.

Each key has its own JSON file containing only `secret` and optional `expiresAt`, as defined by
CredentialValue. Filenames use reversible lower-case hex encoding of the key's UTF-16 bytes, with a
`key-` prefix; they are not hashes or secret encryption. This preserves case-sensitive key identity on
case-insensitive filesystems and keeps slashes and reserved names out of filesystem path syntax.
Filesystem path-length limits still apply; an overlong key fails rather than selecting another name.

Writes create an owner-only temporary file and replace the single destination through `@qflow/file-io-node`.
On Windows this uses native POSIX replacement semantics, so an open reader keeps the old file
while a new open sees the replacement; it does not use Node’s `MoveFileExW` path. Different
keys do not overwrite each other's updates. Reads see a complete document, and the last completed
replacement of the same key supplies its value. There is no process-local queue or cross-process
coordination; filesystem errors propagate to the caller rather than being retried or hidden.
The Store does not enumerate credentials, maintain an index, or record write history.
Permission and I/O errors propagate. Existing directory permissions are not silently changed.
