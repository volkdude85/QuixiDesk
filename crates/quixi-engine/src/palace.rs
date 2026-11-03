//! MemPalace-style memory: wings → rooms → drawers, markdown on disk.
//!
//! Upstream QuixiDesk keeps a single `memory/MEMORY.md` that only the UI ever reads — nothing
//! injects it into a prompt and nothing searches it, so the model is blind to it. This is the
//! replacement: a hierarchical store where every fact has an address, files are ordinary markdown
//! a human can read and edit, and retrieval is a ranked search rather than a paste.
//!
//! Layout, under the palace root:
//!
//! ```text
//! wings/<wing>/rooms/<room>/<drawer>.md
//! ```
//!
//! A *wing* is a broad domain (personal, projects, machines). A *room* is a topic inside it
//! (billing, deploy, hardware). A *drawer* is one document — a fact set, a decision, a note.
//!
//! Everything a caller supplies becomes a path component, so every segment is validated as one.
//!
//! # Credit
//!
//! The wings → rooms → drawers model, and the name MemPalace, come from the MemPalace project
//! (<https://github.com/MemPalace/mempalace>, MIT), created by **Milla Jovovich** and **Ben Sigman**.
//! Their own attribution is in the project's `docs/HISTORY.md` ("A Note from Milla & Ben"). This is
//! an independent implementation of the idea inside QuixiDesk's engine — no MemPalace source was
//! copied — but the design is theirs and the credit is theirs. If you find this useful, the thing
//! to go and look at is the original.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

/// One stored document.
#[derive(Clone, Debug)]
pub struct Drawer {
    pub wing: String,
    pub room: String,
    pub name: String,
    pub path: PathBuf,
}

/// One search result.
#[derive(Clone, Debug)]
pub struct Hit {
    pub wing: String,
    pub room: String,
    pub name: String,
    pub score: f64,
    pub snippet: String,
}

/// A memory store rooted at a directory.
pub struct Palace {
    root: PathBuf,
}

/// Path segments come from the model, so treat each one as hostile until proven otherwise.
fn safe_segment(s: &str) -> Option<String> {
    let s = s.trim();
    let ok = !s.is_empty()
        && !s.starts_with('.')
        && !s.contains("..")
        && !s.contains('/')
        && !s.contains('\\')
        && s.chars()
            .all(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | ' '));
    if !ok {
        return None;
    }
    // Spaces are legal in a name but awkward in a path; normalise them rather than reject.
    Some(s.replace(' ', "-"))
}

impl Palace {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn wing_dir(&self, wing: &str) -> Option<PathBuf> {
        safe_segment(wing).map(|w| self.root.join("wings").join(w))
    }

    fn room_dir(&self, wing: &str, room: &str) -> Option<PathBuf> {
        Some(self.wing_dir(wing)?.join("rooms").join(safe_segment(room)?))
    }

    /// Write a drawer, creating its wing and room.
    pub fn remember(
        &self,
        wing: &str,
        room: &str,
        name: &str,
        content: &str,
    ) -> Result<PathBuf, String> {
        let dir = self
            .room_dir(wing, room)
            .ok_or_else(|| format!("invalid wing or room: {wing:?} / {room:?}"))?;
        let file = safe_segment(name).ok_or_else(|| format!("invalid drawer name: {name:?}"))?;
        fs::create_dir_all(&dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
        let path = dir.join(format!("{file}.md"));
        fs::write(&path, content).map_err(|e| format!("could not write {}: {e}", path.display()))?;
        Ok(path)
    }

    /// Read one drawer.
    pub fn read(&self, wing: &str, room: &str, name: &str) -> Option<String> {
        let dir = self.room_dir(wing, room)?;
        let file = safe_segment(name)?;
        fs::read_to_string(dir.join(format!("{file}.md"))).ok()
    }

    /// Every drawer, optionally narrowed to a wing and/or room.
    pub fn list(&self, wing: Option<&str>, room: Option<&str>) -> Vec<Drawer> {
        let mut out = Vec::new();
        let wings_root = self.root.join("wings");
        let wings: Vec<String> = match wing {
            Some(w) => safe_segment(w).map(|w| vec![w]).unwrap_or_default(),
            None => read_dir_names(&wings_root),
        };
        for w in wings {
            let rooms_root = wings_root.join(&w).join("rooms");
            let rooms: Vec<String> = match room {
                Some(r) => safe_segment(r).map(|r| vec![r]).unwrap_or_default(),
                None => read_dir_names(&rooms_root),
            };
            for r in rooms {
                let dir = rooms_root.join(&r);
                for file in read_dir_names(&dir) {
                    let Some(stem) = file.strip_suffix(".md") else { continue };
                    out.push(Drawer {
                        wing: w.clone(),
                        room: r.clone(),
                        name: stem.to_string(),
                        path: dir.join(&file),
                    });
                }
            }
        }
        out.sort_by(|a, b| (&a.wing, &a.room, &a.name).cmp(&(&b.wing, &b.room, &b.name)));
        out
    }

    /// Ranked search across every drawer.
    ///
    /// Scoring is deliberately simple and explainable rather than clever: a term in the address
    /// (wing/room/name) outranks a term in the body, repeated body terms accumulate, and a whole
    /// phrase match outranks scattered words. No embeddings, no hidden model — so a miss is
    /// debuggable by looking at the files.
    pub fn search(&self, query: &str, limit: usize) -> Vec<Hit> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Vec::new();
        }
        let terms: Vec<String> = q
            .split(|c: char| !c.is_alphanumeric())
            .filter(|t| t.len() > 1)
            .map(str::to_string)
            .collect();
        if terms.is_empty() {
            return Vec::new();
        }

        let mut hits = Vec::new();
        for drawer in self.list(None, None) {
            let Ok(body) = fs::read_to_string(&drawer.path) else { continue };
            let body_l = body.to_lowercase();
            let address = format!(
                "{}/{}/{}",
                drawer.wing, drawer.room, drawer.name
            )
            .to_lowercase();

            let mut score = 0.0f64;
            // The phrase bonus only means something for a multi-word query. Applying it to a single
            // word made any drawer whose body mentioned that word outrank a drawer actually named
            // after it, which is precisely backwards.
            if q.split_whitespace().count() > 1 && body_l.contains(&q) {
                score += 12.0;
            }
            for term in &terms {
                if address.contains(term) {
                    score += 5.0;
                }
                let n = body_l.matches(term.as_str()).count();
                if n > 0 {
                    // Diminishing returns, so one very chatty drawer cannot bury the rest.
                    score += 1.0 + (n as f64).min(8.0).sqrt();
                }
            }
            if score == 0.0 {
                continue;
            }
            hits.push(Hit {
                wing: drawer.wing,
                room: drawer.room,
                name: drawer.name,
                score,
                snippet: snippet_for(&body, &terms),
            });
        }
        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.name.cmp(&b.name))
        });
        hits.truncate(limit);
        hits
    }

    /// A compact index: wing → room → drawer count.
    pub fn index(&self) -> Value {
        let mut wings: std::collections::BTreeMap<String, std::collections::BTreeMap<String, usize>> =
            Default::default();
        for d in self.list(None, None) {
            *wings
                .entry(d.wing)
                .or_default()
                .entry(d.room)
                .or_insert(0) += 1;
        }
        json!(wings
            .into_iter()
            .map(|(w, rooms)| {
                let total: usize = rooms.values().sum();
                json!({
                    "wing": w,
                    "drawers": total,
                    "rooms": rooms.into_iter().map(|(r, n)| json!({"room": r, "drawers": n})).collect::<Vec<_>>(),
                })
            })
            .collect::<Vec<_>>())
    }

    /// Fold the upstream single-file memory in, so existing content is not orphaned.
    pub fn import_legacy(&self, content: &str) -> Result<PathBuf, String> {
        self.remember("hermes", "legacy-memory", "MEMORY", content)
    }
}

fn read_dir_names(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        .collect();
    names.sort();
    names
}

/// The first line that mentions a term, trimmed to something readable.
fn snippet_for(body: &str, terms: &[String]) -> String {
    for line in body.lines() {
        let l = line.trim();
        if l.is_empty() {
            continue;
        }
        let lower = l.to_lowercase();
        if terms.iter().any(|t| lower.contains(t)) {
            return l.chars().take(180).collect();
        }
    }
    body.lines()
        .find(|l| !l.trim().is_empty())
        .map(|l| l.trim().chars().take(180).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> PathBuf {
        let p = std::env::temp_dir().join(format!("palace-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn a_drawer_round_trips() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("work", "billing", "invoice-dates", "Invoice 2026-10-09.").unwrap();
        assert_eq!(
            p.read("work", "billing", "invoice-dates").as_deref(),
            Some("Invoice 2026-10-09.")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn path_segments_cannot_escape_the_root() {
        let root = tmp();
        let p = Palace::new(root.clone());
        for (w, r, n) in [
            ("../../etc", "x", "y"),
            ("a", "../..", "y"),
            ("a", "b", "../../../etc/passwd"),
            ("/abs", "b", "c"),
            ("a", "b", "c/d"),
            ("a", "b", ".."),
            ("a", "b", ""),
        ] {
            assert!(p.remember(w, r, n, "x").is_err(), "accepted {w}/{r}/{n}");
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn search_ranks_a_name_match_above_a_passing_mention() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("projects", "engine", "tensor-layout", "how weights are laid out").unwrap();
        p.remember("notes", "misc", "random", "one line that mentions tensor once").unwrap();

        let hits = p.search("tensor", 10);
        assert_eq!(hits[0].name, "tensor-layout", "{:?}", hits.iter().map(|h| &h.name).collect::<Vec<_>>());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_address_match_outranks_a_body_match() {
        let root = tmp();
        let p = Palace::new(root.clone());
        // drawer named for the term, body unrelated
        p.remember("projects", "engine", "kanban", "nothing relevant here at all").unwrap();
        // drawer whose body mentions it many times but is not named for it
        p.remember("notes", "misc", "notes-a", &"kanban ".repeat(6)).unwrap();

        let hits = p.search("kanban", 10);
        assert_eq!(hits[0].name, "kanban");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_phrase_match_beats_scattered_terms() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("a", "b", "phrase", "the quick brown fox").unwrap();
        p.remember("a", "b", "scattered", "quick ... elsewhere ... brown ... fox").unwrap();

        let hits = p.search("quick brown fox", 10);
        assert_eq!(hits[0].name, "phrase");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_empty_or_symbol_only_query_returns_nothing_and_does_not_panic() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("a", "b", "c", "content").unwrap();
        assert!(p.search("", 10).is_empty());
        assert!(p.search("   ", 10).is_empty());
        assert!(p.search("!!!", 10).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn listing_narrows_by_wing_and_room() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("work", "billing", "a", "x").unwrap();
        p.remember("personal", "health", "b", "x").unwrap();
        p.remember("projects", "engine", "c", "x").unwrap();

        assert_eq!(p.list(None, None).len(), 3, "three drawers, one per wing");
        assert_eq!(p.list(Some("personal"), None).len(), 1, "personal holds one of them");
        assert_eq!(p.list(Some("work"), Some("billing")).len(), 1, "work/billing holds one");
        assert_eq!(p.list(Some("personal"), Some("billing")).len(), 0, "that room lives under work, not personal");
        assert_eq!(p.list(Some("nope"), None).len(), 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_index_reports_counts_per_wing_and_room() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("work", "billing", "a", "x").unwrap();
        p.remember("work", "billing", "b", "x").unwrap();
        p.remember("projects", "engine", "c", "x").unwrap();

        let idx = p.index();
        let arr = idx.as_array().unwrap();
        assert_eq!(arr.len(), 2, "two wings: work and projects");
        // The fixture puts two drawers under work and one under projects; this used to look for a
        // "personal" wing that the fixture never created.
        let work = arr.iter().find(|w| w["wing"] == "work").expect("work wing in the index");
        assert_eq!(work["drawers"], 2);
        let projects = arr.iter().find(|w| w["wing"] == "projects").expect("projects wing in the index");
        assert_eq!(projects["drawers"], 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn search_honours_the_limit() {
        let root = tmp();
        let p = Palace::new(root.clone());
        for i in 0..30 {
            p.remember("a", "b", &format!("d-{i}"), "shared term here").unwrap();
        }
        assert_eq!(p.search("shared", 5).len(), 5);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn every_hit_carries_a_snippet() {
        let root = tmp();
        let p = Palace::new(root.clone());
        p.remember("a", "b", "c", "intro line\n\nthe needle is here\n\nmore").unwrap();
        let hits = p.search("needle", 5);
        assert!(hits[0].snippet.contains("needle"), "{}", hits[0].snippet);
        fs::remove_dir_all(root).unwrap();
    }
}
