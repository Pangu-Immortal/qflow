# `@qflow/source`

The byte-oriented Source contract shared by Author and Run compilation.

`SourceUnit` contains opaque bytes and Workspace-canonical identity. `ResolvedSource` pairs those
bytes with the exact trusted Frontend selected by the caller, Workspace mount or package Source
export. Source itself never guesses from a suffix or body and has no default parser.

`@qflow/source/text` is the optional adapter used by Qflow's self-described UTF-8 author files. It
recognizes one bounded Header such as:

```xml
<?svml using="@qflow/markup@1"?>
```

The adapter masks the Header while preserving UTF-16 offsets and line breaks. Other Workspaces can
produce `ResolvedSource` directly and need not use text or a Header. Neither entry recognizes
imports, XML, Script, Recipes, Run syntax or domain Types; those belong to the selected Frontend.
