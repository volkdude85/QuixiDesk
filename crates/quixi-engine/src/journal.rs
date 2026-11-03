//! Append-only session journal: one file per session, updated in place.
//!
//! The twin of `~/Projects/palace-journal`, and deliberately the same on-disk format so a session
//! recorded here is readable by that tool and vice versa. See that project's README for the
//! measurements; the short version is that appending costs the size of the new record, while
//! rewriting the session file each turn costs the sum of every size so far — O(n²) for a linear
//! amount of content, which is the memory hole this exists to avoid.
//!
//! Records are written with one `write_all` on an `O_APPEND` handle, so a crash leaves a boundary
//! between records rather than a torn file, and concurrent writers cannot interleave.
//!
//! Failures are swallowed by the callers on purpose: a journal that breaks a conversation is worse
//! than no journal.

use std::collections::HashSet;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;

/// What a record represents.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Input,
    Output,
    Note,
}

impl Kind {
    fn tag(self) -> &'static str {
        match self {
            Kind::Input => "in",
            Kind::Output => "out",
            Kind::Note => "note",
        }
    }
}

/// Result of attempting to record.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Appended { bytes: usize },
    Duplicate,
}

/// A session journal handle.
pub struct Journal {
    path: PathBuf,
    file: File,
    seen: HashSet<String>,
}

impl Journal {
    /// Open (or create) the journal for `session` under `dir`.
    ///
    /// `dir` defaults to `~/.mempalace/journal`, which is where the Hermes-side hooks write, so one
    /// machine has one journal rather than two that never meet.
    pub fn open(session: &str) -> std::io::Result<Self> {
        let dir = journal_dir();
        Self::open_in(&dir, session)
    }

    pub fn open_in(dir: &Path, session: &str) -> std::io::Result<Self> {
        std::fs::create_dir_all(dir)?;
        let safe: String = session
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .take(80)
            .collect();
        let day = Utc::now().format("%Y%m%d");
        let path = dir.join(format!("{day}-{safe}.md"));

        let mut seen = HashSet::new();
        if let Ok(text) = std::fs::read_to_string(&path) {
            for line in text.lines() {
                if let Some(rest) = line.strip_prefix("=== ") {
                    // "=== <ts> <kind> <hash> [k=v ...]"
                    if let Some(hash) = rest.split_whitespace().nth(2) {
                        seen.insert(hash.to_string());
                    }
                }
            }
        }

        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self { path, file, seen })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Append a record. A record whose hash is already in this session is refused, so a retried or
    /// regenerated turn does not duplicate.
    pub fn record(&mut self, kind: Kind, body: &str, model: Option<&str>, elapsed_ms: u64) -> std::io::Result<Outcome> {
        let hash = hash_of(kind, body, model);
        if !self.seen.insert(hash.clone()) {
            return Ok(Outcome::Duplicate);
        }

        let mut buf = String::with_capacity(body.len() + 160);
        buf.push_str("=== ");
        buf.push_str(&Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string());
        buf.push(' ');
        buf.push_str(kind.tag());
        buf.push(' ');
        buf.push_str(&hash);
        if let Some(m) = model.filter(|m| !m.is_empty()) {
            buf.push_str(" model=");
            buf.push_str(m);
        }
        if elapsed_ms > 0 {
            buf.push_str(" ms=");
            buf.push_str(&elapsed_ms.to_string());
        }
        buf.push('\n');
        buf.push_str(body.trim_end());
        buf.push_str("\n\n");

        self.file.write_all(buf.as_bytes())?;
        self.file.flush()?;
        Ok(Outcome::Appended { bytes: buf.len() })
    }
}

/// Where the journal lives. `QUIXI_JOURNAL_DIR` wins so a test or a throwaway run can be pointed
/// somewhere else without touching the real one.
pub fn journal_dir() -> PathBuf {
    if let Ok(d) = std::env::var("QUIXI_JOURNAL_DIR") {
        if !d.is_empty() {
            return PathBuf::from(d);
        }
    }
    if let Some(home) = dirs::home_dir() {
        return home.join(".mempalace").join("journal");
    }
    PathBuf::from("/tmp/quixidesk-journal")
}

/// 64-bit FNV-1a over the record identity. Detects a duplicate turn; not a security primitive.
fn hash_of(kind: Kind, body: &str, model: Option<&str>) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let mut eat = |b: u8| {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    };
    for b in kind.tag().as_bytes() {
        eat(*b);
    }
    for b in body.trim_end().as_bytes() {
        eat(*b);
    }
    if let Some(m) = model {
        for b in m.as_bytes() {
            eat(*b);
        }
    }
    format!("{h:016x}")
}

// ── Convenience wrappers callers use ─────────────────────────────────────────────────────────────
//
// Every one of these returns () and logs nothing on failure. Recording a turn is not allowed to be
// the reason a turn fails.

/// Record a user input. Call at send time.
pub fn record_input(session_id: &str, text: &str) {
    if text.trim().is_empty() {
        return;
    }
    if let Ok(mut j) = Journal::open(session_id) {
        let _ = j.record(Kind::Input, text, None, 0);
    }
}

/// Record an assistant reply. Call when the turn completes.
pub fn record_output(session_id: &str, text: &str, model: &str, elapsed_ms: u64) {
    if text.trim().is_empty() {
        return;
    }
    if let Ok(mut j) = Journal::open(session_id) {
        let _ = j.record(Kind::Output, text, Some(model), elapsed_ms);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(tag: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "quixi-journal-{tag}-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let _ = std::fs::remove_dir_all(&p);
        p
    }

    #[test]
    fn growth_is_linear_not_quadratic() {
        // The failure this guards against is a design that REWRITES the session file each turn: then
        // turn n writes the whole file again and the second half of a session costs ~3x the first.
        // Comparing "51 records vs 50x one record" does not test that — with small bodies the
        // per-record header dominates and 51 records legitimately exceed 50x a single record.
        // The property is that each block of records adds the SAME amount.
        let d = tmp("append");
        let mut j = Journal::open_in(&d, "s1").unwrap();
        let path = j.path().to_path_buf();
        let size = || std::fs::metadata(&path).unwrap().len();

        for i in 0..25 {
            j.record(Kind::Input, &format!("first block {i}"), None, 0).unwrap();
        }
        let after_first = size();
        for i in 0..25 {
            j.record(Kind::Input, &format!("second block {i}"), None, 0).unwrap();
        }
        let after_second = size();

        let first_block = after_first;
        let second_block = after_second - after_first;
        // Linear: the two blocks cost the same. Quadratic (rewrite-per-turn) would make the second
        // block roughly three times the first, because it re-writes everything written so far.
        let ratio = second_block as f64 / first_block as f64;
        assert!(
            ratio > 0.9 && ratio < 1.1,
            "each block of 25 records must cost the same: first {first_block}, second {second_block} (ratio {ratio:.2})"
        );
    }

    #[test]
    fn duplicate_refused_and_refused_after_reopen() {
        let d = tmp("dupe");
        {
            let mut j = Journal::open_in(&d, "s2").unwrap();
            assert!(matches!(
                j.record(Kind::Input, "same", None, 0).unwrap(),
                Outcome::Appended { .. }
            ));
        }
        let mut j = Journal::open_in(&d, "s2").unwrap();
        assert_eq!(j.record(Kind::Input, "same", None, 0).unwrap(), Outcome::Duplicate);
    }

    #[test]
    fn format_matches_the_standalone_tool() {
        let d = tmp("format");
        let mut j = Journal::open_in(&d, "s3").unwrap();
        j.record(Kind::Output, "reply body", Some("m1"), 42).unwrap();
        let text = std::fs::read_to_string(j.path()).unwrap();
        // "=== <RFC3339 with ms>Z out <16 hex> model=m1 ms=42" then body then blank line
        assert!(text.starts_with("=== "));
        assert!(text.contains(" out "));
        assert!(text.contains(" model=m1"));
        assert!(text.contains(" ms=42"));
        assert!(text.ends_with("\n\n"));
        let header = text.lines().next().unwrap();
        let parts: Vec<&str> = header.split_whitespace().collect();
        assert_eq!(parts[0], "===");
        assert!(parts[1].ends_with('Z'), "timestamp is UTC: {}", parts[1]);
        assert_eq!(parts[2], "out");
        assert_eq!(parts[3].len(), 16, "hash is 16 hex chars");
    }

    #[test]
    fn empty_text_is_not_recorded() {
        let d = tmp("empty");
        record_input_with_dir(&d, "s4", "   ");
        assert!(std::fs::read_dir(&d).map(|m| m.count()).unwrap_or(0) == 0);
    }

    fn record_input_with_dir(dir: &Path, session: &str, text: &str) {
        if text.trim().is_empty() {
            return;
        }
        if let Ok(mut j) = Journal::open_in(dir, session) {
            let _ = j.record(Kind::Input, text, None, 0);
        }
    }

    #[test]
    fn session_id_cannot_escape_the_directory() {
        let d = tmp("escape");
        let j = Journal::open_in(&d, "../../etc/passwd").unwrap();
        let p = j.path().to_path_buf();
        assert!(p.starts_with(&d), "path must stay inside the journal dir: {p:?}");
    }
}
