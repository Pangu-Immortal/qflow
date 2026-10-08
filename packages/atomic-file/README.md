# `@qflow/atomic-file`

Node filesystem operations shared by file-backed adapters. This package has no knowledge of
credentials, Build Results, Runtime or repository formats.

`replaceFile(from, to)` publishes a complete file at a destination on the same filesystem. The
caller owns creating and closing the source file, its contents and permissions, and temporary-file
cleanup. Existing readers retain the old file; subsequent opens see the new file. The destination
may be absent. Concurrent replacements are ordered by the filesystem, with the last replacement
supplying the current value.

POSIX uses Node's `rename`. Windows uses `SetFileInformationByHandle(FileRenameInfoEx)` with
`REPLACE_IF_EXISTS | POSIX_SEMANTICS`.
This avoids `MoveFileExW` rejecting replacement while another process has the destination open.
The native structure layout comes from Koffi; constants are Windows API values.

There is no pre-read, queue, lock file, retry or fallback. Windows filesystems must support this
operation; unsupported operations, access denials and other I/O errors are reported to the caller.
Read-only destinations are not overridden. The package does not promise power-loss durability or
coordinate transactions across multiple files.
