# `@qflow/blob`

Domain-neutral nominal contract for one byte Artifact referenced by a Runtime Resource id.

`Blob` wraps the Protocol `BlobRef` storage form in an owner-defined `TypeRef`, allowing any
domain to place files, model outputs or other immutable bytes on Graph edges without borrowing a
media/video type. Artifact storage and transfer remain separate Runtime ports implemented by
the single-host Runtime's build-local Resource store.

The package has no filesystem, network, media or Provider behavior.
