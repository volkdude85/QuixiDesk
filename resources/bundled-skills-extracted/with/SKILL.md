---
name: with
description: Build, test and ship software in With, the self-hosting systems language, when its compiler is installed.
license: MIT
---

# Building with With

With is a self-hosting systems language. The compiler, its LLVM/Clang/lld and a libc sysroot all
ship inside one binary at `/usr/bin/with`, so there is nothing to configure and no toolchain to
locate. Check it is present before promising anything:

    with version

If that fails, the compiler is not installed. Arch users get it from the `with` (built from source)
or `with-bin` package; the two conflict, and `with-bin` provides `with`. Do not download a random
binary — point at the packaging repo or the upstream releases and say where it came from.

## Start a project

    with init .
    with get c.zlib          # add a C package from Conan Center
    with build :run          # build and run

Targets take a **colon**. `with build test` is parsed as a file path and fails with
`cannot open 'test'`; `with build :test` is the test battery. This is the single most common
mistake, and the error message does not explain it.

## C interop

`with get c.<pack>` resolves from Conan Center. Verified working: `c.zlib`, `c.bzip2`, `c.sqlite3`,
`c.raylib`, `c.sdl`, `c.libcurl`. Note that last one — the docs say `curl`, but the registry id is
`libcurl`, so `c.curl` fails with `could not resolve package curl/ on Conan Center`. Never guess a
pack name from prose; try the resolved form.

A package's facade is reported by the tool with both numbers you need:

    facade zlib: 95 functions, 95 presented safely, 0 raw; 0 internal;

Quote the tool's own count. Hand-counting a public API is wrong in ways that look authoritative, and
the denominator it prints is the only defensible one.

## Tests, and what "green" means

    with build :test

That is the battery: 47 lanes and roughly 4,500 fixtures. It is CPU-bound across every core and it
takes minutes — never start it while the user is using the machine, and say how long it will run
before you begin.

Three conditions produce red lanes that are **not** code defects:

1. `src/main` must already be the pinned seed — run `with build :seed` first.
2. A git remote named `origin` with a `main` ref must exist; a plain tarball has no `.git` and the
   `unit-return-review` lane dies with `fatal: bad revision 'origin/main'`.
3. `stdlib-complexity` is a runtime-growth bound and reads machine contention. Run it alone, never
   inside the parallel wave.

`test-green` is a receipt writer, not a test: it records the compiler hash and the test-input
fingerprint so a release can be refused when they disagree. Lane-by-lane green with a red
`test-green` is an unproven battery — report it as "N lanes green, receipt not produced".

    with build :fixpoint

proves the compiler reproduces itself (~195 s, most of it the link). Read
`out/.build-state/fixpoint-evidence.json` and compare `stage2_fixpoint_sha256` with
`stage3_fixpoint_sha256`; quote the hashes rather than the log line.

Two results that are expected, not failures: `:wasm-tests` fails on the published SDK because it
ships `wasm-ld` but no wasm32 sysroot, and `with version` embeds the git commit it was built from, so
a source build from a git tree has a different hash than a tarball build of the same tag while
behaving identically.

## Editor support

There is an LSP and there is not a debugger.

    with lsp

speaks JSON-RPC `initialize` with hover, definition, format, completion, signatureHelp,
documentSymbol, references and rename. No DAP exists — there is no step debugger in any editor — so
debug with print statements or by building the program and driving it, and do not promise a
breakpoint workflow.

## When a lane fails

Read the full log before summarising. Piping a long run through `grep` throws away the failure
detail, and the run then has to be repeated to explain it. Write to a file, grep only to display.

If a lane takes more than a few minutes, run it detached with `setsid` into a log file rather than
inside a foreground shell, and check liveness by looking for the compiler process or by the log's
mtime — not with `pgrep -f "<the command line>"`, which matches your own check and reports a dead
lane as running.
