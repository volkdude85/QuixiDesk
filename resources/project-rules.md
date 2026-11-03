# Project rules

The standing rules for work in this workspace. They are the same ones the Ceilium model is built under,
because the failures they prevent are not specific to one project.

## Language, in order

1. **C++ and assembly first.** This is the preferred language and the preferred method for anything the
   machine has to do quickly: tight loops, data layout, kernels, numeric paths, anything where the shape
   of memory matters as much as the algorithm.
2. **Once the design is settled, Rust if it is faster.** "Faster" means faster to finish and keep working,
   not faster to type. When the C++ or assembly version is already correct, it is the reference that makes
   the Rust version good — a port of something proven kicks ass; a fresh start guesses.
3. **Never Rust instead of thinking.** Choosing Rust to avoid designing the data is how a project ends up
   with an elegant framework around a problem nobody solved.

Everything else — shells, glue, one-shot tools — is whatever gets the answer with the least ceremony.

## How code is written here

- **Architecture before code.** Dissect the problem into its own parts and write the design down first.
  A file written before the shape is known gets rewritten twice.
- **Flat arrays, not matrices.** Index arithmetic over one contiguous allocation. A matrix of small
  objects is a pointer chase wearing a suit.
- **No Python in the core path.** Python is for poking at data, not for the thing that runs.
- **jSat standard, every time:** no leaks (RAII), no undefined behaviour, thread-safe, and clean under
  `-Wall -Wextra -pedantic`. If it does not compile clean it does not ship.
- **No placeholders.** No dead code, no `TODO` that nobody will come back to. A stub is labelled a stub.

## How work is measured

- **Real path, not a smoke test.** Run the actual binary against the actual input and read the actual
  output. A harness that proves the harness works proves nothing.
- **Numbers, not adjectives.** Measure before and after; a claim without a measurement is a guess wearing
  a lab coat. When something is unmeasured, say it is unmeasured instead of estimating.
- **One change at a time.** Two changes and a failure is two questions and no answer.
- **Bit-exactness is an acceptance test** for numeric work: the fast path must agree with the slow path,
  or the difference gets explained rather than shipped.
- **Stuck means go read, not rerun.** Two failures on the same hypothesis means the hypothesis is wrong or
  the question is; the answer is usually written down somewhere already.

## How work is kept

- **Never delete an original.** When something is replaced, the old one stays in `legacy/` with a header
  saying what it is, which commit it came from, and what replaced it. Git history is not a substitute:
  the old version ran, and when the new one misbehaves both have to be on disk.
- **Write the state down.** A handoff that lives only in a conversation is lost at the next compaction.
- **No secrets in a tree.** Keys, tokens and passwords live in the data directory, never in a repository.
- **No personal data in anything published.** No home paths, no addresses, no phone numbers, no names of
  people who did not agree to be in it.

## Tone

Direct. Say what is true, say what is measured, say what is missing. No preamble, no flattery, no
apologising instead of fixing. When something is wrong, fix it in the same turn and say what changed.

---

To give one project its own rules, put a `PROJECT-RULES.md` in that project's folder; it takes precedence
over this file.
