---
name: reverse-engineering
description: "Decompile a binary with Ghidra headless and read the C — functions, call graph, where to look first."
version: 1.0.0
tags: [reverse-engineering, ghidra, decompile, binary, assembly, security]
---

# Reverse-engineering a binary

Ghidra is already installed and its headless analyser works. The hard part is not running it — it is
reading what comes back without drowning in it, and knowing which question to ask first.

## The fast path

A wrapper sits beside this file. It runs `analyzeHeadless`, keeps only the decompiled output, and
throws away the JVM warnings, ELF relocation complaints and progress noise:

```sh
python3 "$(dirname SKILL.md)/ghidra_dump.py" <binary> --max-functions 40
```

- `--max-functions N` — stop after N functions (default 200). Start small.
- `--function-timeout S` — per-function decompiler budget (default 30s).
- `--project DIR --keep` — keep the Ghidra project so a second pass skips re-analysis.
- `--ghidra DIR` — if Ghidra is not at `$GHIDRA_HOME` or `/opt/ghidra`.

It prints `// <address>  <name>` then the C for each function, and a final line telling you whether
more remain. Exit code is 0 only when real output was produced — a silent failure is reported, not
passed off as an empty result.

## What this tells you, and what it does not

Decompiled C is a reconstruction, not source. Treat these as facts and everything else as a guess:

- **function boundaries and call relationships** — reliable
- **string references** — reliable, usually the fastest way in: start from the strings, not the entry point
- **control-flow shape** — usually right
- **variable names, types, struct layouts** — invented unless debug symbols exist. `undefined4` and
  `uVar1` are Ghidra admitting it does not know.

So the useful first move is almost never "dump everything". It is:

1. `strings -n 6 <binary> | grep -i <the thing>` — find the message, URL, error text or flag you care about
2. locate that string's use in the decompiled output
3. walk outward from there through callers

## Doing it by hand

When the wrapper's fixed post-script is not enough, drive Ghidra directly and supply your own script:

```sh
/opt/ghidra/support/analyzeHeadless /tmp/proj myproject \
    -import ./target/release/quixi \
    -scriptPath /path/to/scripts \
    -postScript MyScript.java
```

Ghidra compiles `.java` post-scripts on first use, so a script needs no build step. A script's
`println` output is forwarded to the console prefixed with `INFO  <Script>.java> `.

## Pitfalls that actually bite

- **Ghidra refuses any project path containing a component that starts with `.`** — the error is
  `Path element starting with '.' is not permitted`. Sandboxed `TMPDIR`s (including this agent's own
  scratch directory) usually contain one, so put projects under `/tmp` or `$HOME/projects`. The
  wrapper already handles this.
- **Analysis time scales with binary size, not function count.** `--max-functions` limits what is
  decompiled, not what is analysed. A 40 MB binary can spend several minutes analysing before the
  first function is printed.
- **Java warnings are not failures.** A pile of `WARNING: sun.misc.Unsafe...` lines means the JDK is
  newer than Ghidra expects; the analysis still runs.
- **Stripped binaries decompile to `FUN_0010xxxx` everywhere.** That is normal. Rename what you work
  out (`F` in Ghidra's UI) or keep a notes file mapping addresses to meanings as you go.
- **Never quote decompiled C as if it were the original source.** Say "the decompiler shows", and say
  where the function was.

## When not to use this

If the binary is Go or Rust and not stripped, `strings` plus the symbol table
(`nm -C <binary> | head -100`, `go tool nm`) gives better names than Ghidra ever will. Reach for
Ghidra when symbols are gone and the question is genuinely about code.
