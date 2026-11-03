#!/usr/bin/env python3
"""Decompile a binary with Ghidra headless and print readable C.

`analyzeHeadless` does the work but its output is not usable as-is: every line of the shipped
post-script is prefixed with `INFO  DumpDecomp.java> `, mixed in with JVM warnings, ELF relocation
noise and progress reporting. This runs it, keeps the payload, and drops the rest.

    ./ghidra_dump.py /bin/true
    ./ghidra_dump.py ./target/release/quixi --max-functions 40
    ./ghidra_dump.py firmware.bin --function-timeout 90 --keep /tmp/proj

Exit code is 0 only when the analysis actually produced decompiled output.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PAYLOAD_PREFIX = re.compile(r"^INFO\s+DumpDecomp\.java>\s?(.*)$")
NOISE = re.compile(r"^(INFO|WARN|ERROR)\s+")
JVM_WARNING = re.compile(r"^(WARNING:|openjdk version|OpenJDK Runtime|OpenJDK 64-Bit)")


def ghidra_home(explicit: str | None) -> Path | None:
    for candidate in [
        explicit,
        os.environ.get("GHIDRA_HOME"),
        os.environ.get("GHIDRA_INSTALL_DIR"),
        "/opt/ghidra",
        str(Path.home() / "ghidra"),
    ]:
        if candidate:
            p = Path(candidate)
            if (p / "support" / "analyzeHeadless").exists():
                return p
    return None


def safe_tmpdir() -> str:
    """A scratch directory Ghidra will accept.

    Ghidra refuses any project path containing a path element that starts with '.', with the
    message "Path element starting with '.' is not permitted". That rules out most sandboxed TMPDIRs,
    including the one this runs under by default (/home/<user>/.hermes/.../scratch), so fall back to
    /tmp rather than handing Ghidra a path it will reject.
    """
    for candidate in [os.environ.get("TMPDIR"), "/tmp"]:
        if not candidate:
            continue
        parts = Path(candidate).resolve().parts
        if any(part.startswith(".") for part in parts):
            continue
        if os.access(candidate, os.W_OK):
            return candidate
    return "/tmp"


SUFFIX = re.compile(r"\s*\(GhidraScript\)\s*$")


def extract(raw: str) -> list[str]:
    """Recover exactly what the post-script printed.

    Ghidra echoes a script's stdout two different ways, which is the whole difficulty:

      * a single-line `println` arrives as `INFO  DumpDecomp.java> <text>`
      * a multi-line string arrives with only its FIRST line prefixed; the rest are passthrough, and
        Ghidra appends ` (GhidraScript)` to the end of the block

    So the payload is a block that starts at the prefix and ends at that marker. Everything outside a
    block is banner, the script-path list, ELF relocation complaints or progress reporting, and none
    of it may be mistaken for decompiled output.
    """
    out: list[str] = []
    in_block = False
    for line in raw.splitlines():
        m = PAYLOAD_PREFIX.match(line)
        if m:
            content = SUFFIX.sub("", m.group(1))
            out.append(content)
            in_block = not SUFFIX.search(m.group(1))
            continue
        if in_block:
            if SUFFIX.search(line):
                out.append(SUFFIX.sub("", line))
                in_block = False
            elif NOISE.match(line):
                in_block = False
            else:
                out.append(line)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Decompile a binary with Ghidra headless")
    ap.add_argument("binary", help="file to analyse")
    ap.add_argument("--max-functions", type=int, default=200,
                    help="how many functions to decompile (default 200)")
    ap.add_argument("--function-timeout", type=int, default=30,
                    help="per-function decompiler timeout, seconds (default 30)")
    ap.add_argument("--ghidra", help="Ghidra install directory (default: $GHIDRA_HOME or /opt/ghidra)")
    ap.add_argument("--project", help="project directory to keep (implies --keep)")
    ap.add_argument("--keep", action="store_true", help="keep the project directory and print its path")
    ap.add_argument("--quiet", action="store_true", help="do not print the project path on stderr")
    args = ap.parse_args()

    target = Path(args.binary).expanduser().resolve()
    if not target.exists():
        print(f"ghidra_dump: no such file: {target}", file=sys.stderr)
        return 2

    home = ghidra_home(args.ghidra)
    if home is None:
        print(
            "ghidra_dump: no Ghidra install found. Set GHIDRA_HOME or pass --ghidra <dir>; the "
            "script expects <dir>/support/analyzeHeadless.",
            file=sys.stderr,
        )
        return 2

    scripts = Path(__file__).resolve().parent
    if not (scripts / "DumpDecomp.java").exists():
        print(f"ghidra_dump: DumpDecomp.java is missing from {scripts}", file=sys.stderr)
        return 2

    keep = args.keep or bool(args.project)
    project_dir = Path(args.project).expanduser() if args.project else Path(tempfile.mkdtemp(prefix="ghidra_dump_", dir=safe_tmpdir()))
    project_dir.mkdir(parents=True, exist_ok=True)
    project_name = "quixi_dump"

    env = dict(os.environ)
    env["QUIXI_GHIDRA_MAX_FUNCTIONS"] = str(args.max_functions)
    env["QUIXI_GHIDRA_FN_TIMEOUT"] = str(args.function_timeout)

    cmd = [
        str(home / "support" / "analyzeHeadless"),
        str(project_dir), project_name,
        "-import", str(target),
        "-scriptPath", str(scripts),
        "-postScript", "DumpDecomp.java",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    except OSError as exc:
        print(f"ghidra_dump: could not run analyzeHeadless: {exc}", file=sys.stderr)
        return 2

    payload = extract(proc.stdout + "\n" + proc.stderr)
    c_lines = [line for line in payload if "function(s) printed" in line]
    body = [line for line in payload if "function(s) printed" not in line]

    if not body or not any(line.startswith("// ") for line in body):
        print("ghidra_dump: analysis produced no decompiled output", file=sys.stderr)
        tail = [l for l in (proc.stdout + proc.stderr).splitlines() if l.strip()][-8:]
        for line in tail:
            print(f"  {line}", file=sys.stderr)
        return 1

    print("\n".join(body).strip())
    if c_lines:
        print("\n" + c_lines[-1].strip())
    if not args.quiet:
        if keep:
            print(f"# project kept at {project_dir}", file=sys.stderr)
        else:
            shutil.rmtree(project_dir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
