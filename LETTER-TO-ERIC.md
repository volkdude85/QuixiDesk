# Letter to Eric Hartford — Charter review

*Draft. Not sent. Written 2026-11-18.*

---

Eric,

The shortest version: **§4.5 of your RFC is the correct design and 1.0 doesn't
implement it.**

`SourceRef` with `effectiveFrom`, `effectiveUntil`, `issuingAuthority` and
`signaturePolicy` is exactly the right object — you even wrote, in the same
section, *"Hashing does not itself grant authority."* What shipped is
`Document "path" SHA256 "hex" Rank n`: a digest of a local file, with no issuer,
no validity window, no signature, and an ordinal where a doctrine of authority
belongs. §12.2 lists `SourceRef` as a migration step still to do, so I don't
think you disagree with any of this. That gap is the letter. Everything below is
elaboration on it, one short list of what I'm taking, and four mechanical things
I'd fix this afternoon.

For context on where I'm standing: I'm not a Lean person. I took business law,
not engineering, and I've spent the last couple of years doing real legal work
pro se — statutes, rules, dockets, agency findings, an active family case. So I
read Charter as someone who spends his days asking *which text governs, is it
current, and what follows from it*, rather than as someone who can check a
proof. Everything below is from that side of the glass. Where I'm wrong about
the semantics, say so and I'll take the correction.

Full disclosure on method, since it bears on how much weight to give this: I
skimmed the repo myself and didn't get much from the first page, so I handed it
to Nora — the assistant I run locally — and had her work through the mission and
laws, the RFC, the spec, the server, the battery, `AGENTS.md` and the PSA
properly, and pull your Actions API to see the state of `main`. She did the
technical reading and the verification; I did the judging. The CI findings below
come from that check and are offered as information, not as a gotcha.

---

## What is right here, and why it matters

Four things in the mission document are, I think, the reason this design works
where most rules-as-code work doesn't.

**Law 1 — occurrence is never blocked.** *"A program that makes a forbidden act
unperformable has described a machine, not an institution."* That's the best
sentence in the repository. Most systems in this space collapse *can't* into
*mustn't*, and in doing so they delete the entire remedy structure — there's no
breach to remedy and no damages to measure if the act was never possible. You
kept the distinction and it's load-bearing for everything downstream.

**Law 3 — violations are facts, findings are events.** A breach is recorded when
it happens; a finding is an institutional act whose effect is the declared
remedies; the link between them is an assumption the program states, never a
theorem the language supplies. I've watched agency findings get read as if the
finding *were* the violation for two years. Nobody models this. You did, and you
got the direction right.

**Law 11 — the author never sees Lean**, and you enforce it with a grep over the
tool's own output rather than with good intentions. That's the difference between
a principle and a claim.

**Law 14 — the mission is tested, not described.** One failing program per law.
This is the most transferable single idea in the repo and I'm taking it.

The three-answer ontology — occurred / lawful / valid — is the other thing I'd
defend to anyone. `Valid when` separated from `Holds when`, on an `Act` that
defaults to `Valid when True` so unlawful physical events still record their
consequences and trigger their remedies, while a `Power` has to state its own
validity condition and go void without one: that's the correct asymmetry, and
it's the one every real dispute turns on. `ultra vires`, `void ab initio`, and
`unlawful but effective` are three different outcomes and most tools can express
one of them.

The Hohfeldian `Immunity` as a first-class record with `Holder` / `Against` /
`Holds when` / `Unless`, rather than an ad-hoc negated precondition, is the right
level of abstraction. Immunities are how you stop a power from being exercised,
and they're almost never modelled as data.

And two process things worth naming:

**The tolerance manifest.** Fifty-eight of the 196 eFLINT fixtures diverge and
every one of them is machine-audited in `tolerances.md` with an upstream result,
your result, a root-cause decision ID, and a conformance test. Publishing your
own divergence list, in that much detail, is not normal behaviour and it's the
reason I trust the rest of the numbers.

**`AGENTS.md`.** *We own every bug, nothing is pre-existing. Root cause means the
exact rule, phrase, or step. A tool that stayed silent is a bug. Three-action
trip-wire. Ceremony is a design defect, not an author error.* I have written
process documents for a living and these are better than mine, because every one
of them is testable.

---

## What I'm taking from this repo

Being specific so it's on the record rather than inferred. Nothing is copied —
there's no licence in the repo, so the default is all rights reserved, and I'm
not going to lift code from it. These are ideas rather than code, and I'll credit them where they land:

1. **Law 14's shape** — a failing program per policy, so a policy can't be
   quietly lost. I'm building the equivalent for my own operating rules.
2. **Law 1 and Law 3's ontology** — occurrence is never blocked, and a finding is
   an event with declared remedies rather than a synonym for a breach.
3. **The three-answer separation**, including the `Act`/`Power` default
   asymmetry.
4. **The four claim tags** — `proved / decided / checked / assumed`, never a
   fifth — with the grep gate that keeps `sorry` and `native_decide` out.
5. **The `?why` provenance chain** and the idea that every judgment returns the
   rule it applied and the span it came from.
6. **The battery itself** — the whole notion of a gate per law, run as one
   command, with the summary naming what passed.
7. **`AGENTS.md`'s process rules**, especially the trip-wire and "ceremony is a
   design defect."

If any of that ends up in something I publish, it'll say where it came from.

---

## How we do legal research now, and the rules we run by

Since the suggestions below all come out of this, it's only fair to show the
working. It isn't a tool — it's a discipline written down and enforced by an
assistant that has been told not to guess. Which is precisely the problem I'm
describing: the rules exist, and nothing makes them true.

**The order.** Forum and deadline before argument. Statute text before case law.
Definitions before the operative section. Elements before facts. Remedy and
vehicle named before the argument gets written. Out of order, you produce
something that reads well and loses.

**Which copy counts.** Read at Cornell LII, cite the OLRC edition, the eCFR for
regulations, CourtListener for dockets, and the court's own portal for a live
case — never a secondary summary when the primary answers. A case is authority
for its holding, not its dicta, and only until something overrules it.

**Currency, every time.** No date, figure, or holding from memory. The docket is
re-pulled before anything is said about it, and hearing dates come out of the
calendar attachments — the `text/calendar` block, `DTSTART` and `STATUS` —
rather than the prose of an email, because a `METHOD:CANCEL` with
`STATUS:CANCELLED` on a date everyone believed was live is the most expensive
thing in a mailbox.

**Evidence that the text says what I say it says.** Every outside fact carries an
inline numbered citation drawn from a ledger that only contains URLs actually
fetched. Verbatim quotes are attached to each source and rejected unless the
literal text appears in the fetched page. The source list is generated
mechanically from the ledger rather than retyped, because retyping is where
invented citations come from.

**Honesty about absence.** "I could not check" never becomes "it was never
filed." No filing is asserted without the docket in hand, and when a check is
blocked by a captcha or a paywall, that fact goes into the answer as the answer.
When the record doesn't settle a question, it says so and stops, rather than
reaching for the most dramatic branch to fill the silence.

**Weight as well as basis.** A proposition is tagged with how it is known and,
separately, with what it is worth — binding, persuasive, dicta, superseded.

**Where this is weaker than Charter.** All of it is enforced by an assistant
remembering instructions. Nothing fails to build when a rule is dropped. If the
policy says re-pull the docket and the re-pull doesn't happen, nothing breaks and
nothing shows — which is exactly the failure your Law 14 exists to prevent, and
the reason I'm taking it.

---

## What I'd suggest you consider adding — or where I'd go differently

Eight points. Each one is a design suggestion rather than a bug report, and on
several of them your own RFC already argues my side, which is part of why I'm
writing this at all. Where I say "I'd" read it as "consider" — you know your
constraints and I don't.

### 1. Provenance should be a property of the artifact, not a flag

`--require-provenance` is opt-in. A program with neither `Document` nor `Clause`
is classified `illustrative` and runs normally. And spec 12.7: *"A document that
cannot be read is a warning, not a failure, and the check is skipped."*

Three routes to a green check with zero verification performed. I'd make
coverage a gate on *delivery* instead of a mode: partial provenance is fine for
an author exploring, and refused by `charter gen` and `charter build`, because
those are the paths that produce something another party acts on. I'd also drop
`illustrative` as a state name — an ungrounded program is a grammar exercise and
the tool should say that rather than give it a neutral label.

Your own `AGENTS.md` says no silent fallbacks and that a tool which stayed silent
is a bug. 12.7 is a silent fallback written into the spec.

### 2. The hash pins the copy, not the currency

`Document "path" SHA256 "hex"` digests a file relative to the program. Nothing
reaches the OLRC, oregonlegislature.gov, the eCFR, or a court's own docket to ask
whether that file is the text currently in force.

So a fully green Charter program can be a formally flawless formalization of a
**superseded** statute: every span verbatim, every rule grounded, every hash
matching, and the law moved three years ago. `trust.md` concedes the neighbouring
question — whether the rule captures the meaning of the prose is human judgement,
never mechanical — but currency isn't conceded, it isn't modelled.

This is the gap that costs me the most in practice, because the tool would look
rigorous while being wrong, which is the worst combination. I'd tie the digest to
an issuer and an effective window, add a resolve-and-compare step per
jurisdiction and source class, and give an unreachable source a first-class state
— `UNVERIFIED_AS_OF <date>` — that travels with every output derived from it.

Which is, near enough, `SourceRef` from §4.5, and §12.2 lists shipping it as a
migration step still to do. **§4.5 is the correct design and 1.0 doesn't
implement it.** That's the single most useful sentence I can offer you.

### 3. Rules need effective windows, and judgements should be as-of a date

`Time` and `Duration` over facts and duties are genuinely good — half-open
expiry, `Held … For`, deadlines that breach without a synthetic lapse event.
But `Amend` changes the rule set and there's no way to ask what the answer was
under the rules in force in March 2023. Everything is evaluated under the current
program.

I'd hang an effective window on `Regime` and answer every question **as of** a
date, defaulting to the date of the *event* rather than to now, and report which
rule set was used.

This isn't a feature, it's the reason legal systems have the shape they do. Ex
post facto, vested rights, contracts clause, retroactivity in an operating
agreement or a custody modification — all of it turns on which rules governed
conduct at the time. A tool that evaluates all history under today's rules will
be confidently wrong on a whole class of real questions, and the machinery for
doing it properly is already in your tree.

### 4. `Rank n` is an ordinal, not a doctrine of authority

`Rank 1` outranking `Rank 2` between otherwise-unranked cross-document
`Default`/`Exception` rules is an integer the author assigns. It can't express a
later statute repealing an earlier one, a regulation invalid for exceeding its
statute, a case construing a phrase, holding versus dicta, or a regulation whose
reading changed without a word of text changing.

I'd make authority a relation with a stated reason: a source kind
(constitution / statute / regulation / rule / order / judgment / agreement), an
issuer, and precedence rules declared in the program as records you can point at
— "this bylaw yields to that statute because the statute sits higher in the
issuer's own hierarchy." §4.6 proposes `lib/jurisdiction.charter` +
`Core/Composition` for exactly this, which is the right instinct. The shipped
integer isn't it. The disputes that decide cases are conflicts between
authorities, not orderings within one.

### 5. Four tags describe how we know; nothing describes how much it's worth

`proved / decided / checked / assumed` is a good taxonomy, honestly enforced.
But a `checked` verbatim quote from a dissent is checked and worthless as
authority, and a `proved` theorem about `Law σ` says nothing at all about
ORS 107.137.

I'd add a second axis — epistemic basis × authority weight (binding / persuasive /
superseded / overruled / dicta / unpublished / on appeal) — because the label
answers *how sure are we that this is what the document says* when the reader's
real question is *does this bind anyone*. That conflation is the most common way
a legal argument dies, and it's one field on the record.

### 6. An unresolved fact should fail a burden of proof, not abort the matter

An unassigned `Open` fact raises `CHR100` and evaluation halts. The richer
`Evidenced` path with `Established / Refuted / Unresolved / Conflicted` and
`Finding` exists and is tested, and it's the right direction — but a plain `Open`
fact still aborts, and the richer path isn't required for a judgement to render.

In an actual proceeding a missing fact doesn't stop the world. It produces a
failure of proof for whoever carried the burden, and *that* is the outcome. I'd
put the burden on the norm — `Duty … Burden preponderance On claimant` — require
an evidence status on every `Open`/`Evidenced` premise used in a judgement, and
have `Unresolved` discharge against the burden-holder instead of aborting.
Aborting is a programming semantic in a legal costume, and it changes real
results: it produces "we can't say" where the correct answer is "the claimant
loses that element."

### 7. I'd unwind the eFLINT superset guarantee and keep the corpus

Law 12 says Charter extends and does not revise; Law 13 says one spelling per
meaning and the old one gets deleted rather than deprecated. Those two are
already in tension, and the 39-entry tolerance manifest is the receipt. Fifty-
eight of 196 fixtures diverge.

I'd keep the corpus as a regression oracle — it's genuinely valuable and there's
nothing else like it — and drop the superset as a *law*. Provide a one-way
importer instead. A superset inherits every defect it lacks the standing to fix,
and the tolerance list is a permanent tax on every future grammar change. You can
see it biting already: §12.2 has to strip v0.3 duplication and replace reserved
words with contextual keywords purely to make the superset hold. That's a lot of
effort spent on compatibility with a research prototype, in a language whose
ambition is to be the last one anyone needs.

### 8. `Commentary` as formally inert is where interpretation goes to die

Five registers, and only four have formal consequences; `Commentary` has no
target. But recitals, preambles, whereases, and purpose clauses are where a court
goes to decide what the operative text means.

I'd give purpose a register with a bounded, declared use: admissible for
construction, inadmissible for creating a duty, and citable by a rule as a
construction aid with that edge recorded on the rule so the reliance is visible.
A model that files purpose as inert reproduces, systematically, the failure mode
of plain-meaning-only analysis — it will read every ambiguous operative clause
against the drafter's intent, because it threw the intent away at parse time.

---

## The mechanical things I'd fix first

In order, because these are the cheapest and they're the ones a stranger hits
first.

1. **There is no LICENSE file.** Default is all rights reserved. For a language
   whose second goal is to be universal, that's the largest adoption blocker in
   the repo and it's five minutes.

2. **`main` is red, and has been for every run.** All eight Actions runs failed.
   `lake build` succeeds across 209 jobs; 22 of 23 battery gates pass — 196/196
   eFLINT corpus, 213/213 spec conformance, 14/14 stdlib, 5/5 `prove`, 18/18
   `verify`, 13/13 `server`, 64 claims verified. Then `projections` returns
   `7 passed, 1 failed, 8 total`.

3. **The battery doesn't say which case failed.** The summary line reports the
   count and nothing else, and the individual case output isn't in the log. I
   couldn't tell you which of the eight it was without building it. A summary
   that says `1 failed` is the tool staying silent about the one thing the reader
   needs — which is the exact failure `AGENTS.md` says is a bug.

4. **The differential suite has never run in CI.** It's a separate step gated
   behind the failing battery step, so solc, Foundry, Quint, and Z3 have not
   executed once. I'd split it into its own workflow immediately, so that a
   projection defect can't mask "the Solidity target doesn't compile."

None of that is a design problem. It's an afternoon.

---

## Last thing

The order of the two goals is what makes this credible, and I don't think it's an
accident that you wrote the precedence rule down. Formalize the protocol first,
generalize second — so the language's constructs were forced to exist by
something real rather than designed in the abstract. That's the opposite of how
most DSLs get built, and it's why the ontology holds up.

I'd like to keep the correspondence going if you're up for it. I'm building
something adjacent from the other end — not a formal language, more a way of
keeping an agent's legal work honest about where each fact came from and how much
it's worth — and I think the two would have things to say to each other.

Either way: thank you for writing the design documents down. Most people don't,
and then the reasoning is lost.

volkdude85

---

*Notes for me before this goes anywhere: no licence in the repo, so this is a
review, not a contribution — don't send patches unless he asks. The CI facts came
from the Actions API on 2026-11-18 against head de90413f; re-check them before
sending, in case he's fixed it since. Nothing personal belongs in here: no case
number, no names, no family. If it goes out it goes out as written.*
