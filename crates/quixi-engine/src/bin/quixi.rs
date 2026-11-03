//! quixi — headless driver for the QuixiDesk engine.
//!
//! The desktop app and this binary run the *same* engine; the only difference is that this one
//! never constructs a window. It links no GUI crate at all, so it runs wherever the engine runs:
//! a server, a container, an SSH session, macOS, or a terminal on a phone.
//!
//! What it gives up is ComputerUse. Screenshots, synthetic input and window management need a
//! display to talk to; on a box with none there is nothing to capture and nothing to click. Chat,
//! tools, files, MCP, subagents and skills all work.
//!
//!   quixi "explain this repo"          one-shot prompt, streamed to stdout
//!   quixi --skills                     list the skills the model is told about
//!   quixi --skill pdf                  print one skill's body (what LoadSkill returns)
//!   quixi --providers                  show configured providers and the active model
//!   quixi --cwd /some/where "prompt"   run the agent in a specific working directory
//!   quixi --json "prompt"              emit the final reply as JSON instead of streaming

use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use quixi_engine::providers::StreamChunk;
use quixi_engine::QuixiEngine;

/// Find the resources directory the engine boots from.
///
/// Mirrors the desktop app's lookup so both find the same bootstrap files, with the installed
/// Arch layout as a last resort.
fn locate_resources() -> PathBuf {
    if let Ok(env_dir) = std::env::var("QUIXI_RESOURCES_DIR") {
        let p = PathBuf::from(env_dir);
        if p.exists() {
            return p;
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // portable, cargo target/release, and macOS .app bundle layouts
            for candidate in [
                dir.join("resources"),
                dir.join("../../resources"),
                dir.join("../Resources"),
            ] {
                if candidate.join("bootstrap").exists() || candidate.join("ui/index.html").exists() {
                    return candidate.canonicalize().unwrap_or(candidate);
                }
            }
        }
    }

    // Installed package layout (PKGBUILD puts resources in /usr/lib/quixidesk).
    PathBuf::from("/usr/lib/quixidesk/resources")
}

fn usage_with(code: i32) -> ! {
    eprintln!(
        "quixi — headless QuixiDesk engine\n\
         \n\
         usage:\n\
         \x20 quixi \"prompt\"              run one prompt, streamed\n\
         \x20 quixi --json \"prompt\"       print the reply as JSON\n\
         \x20 quixi --cwd <dir> \"prompt\"  set the working directory\n\
         \n\
         inspect, no model call:\n\
         \x20 quixi --skills             list skills available to the model\n\
         \x20 quixi --skill <id>         print one skill body\n\
         \x20 quixi --search <query>     search the skill index (--page N for the next page)\n\
         \x20 quixi --prompt-block       print the index the model is actually given\n\
         \x20 quixi --providers          list providers\n\
         \x20 quixi --capabilities       report what this session can actually do\n\
         \n\
         memory:\n\
         \x20 quixi --memory             print the memory index\n\
         \x20 quixi --remember <wing> <room> <name>   store stdin as a memory\n\
         \x20 quixi --recall <query>     search memory (--limit N)\n\
         \x20 quixi --scope              which memory tier the active provider allows\n\
         \n\
         voice:\n\
         \x20 quixi --voice              show the voice configuration\n\
         \x20 quixi --say <text>         speak through the configured backend (--dry-run to skip playback)\n\
         \x20 quixi --transcript         print what the talk service has accumulated\n\
         \n\
         environment:\n\
         \x20 QUIXI_RESOURCES_DIR   override the resources directory\n\
         \x20 QUIXI_PALACE_DIR      point memory at an existing palace\n\
         \x20 HOME                  data lives under $HOME/.quixi; change HOME to isolate a run"
    );
    std::process::exit(code)
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    if argv.is_empty() || argv[0] == "--help" || argv[0] == "-h" {
        usage_with(if argv.is_empty() { 2 } else { 0 });
    }
    // An unrecognised leading option is a mistake, not a prompt: sending `--bogus` to the model
    // spends a call answering a question the user did not ask, and looks like the CLI hung.
    const KNOWN: [&str; 15] = [
        "--skills", "--skill", "--search", "--providers", "--prompt-block", "--json", "--cwd",
        "--remember", "--recall", "--memory", "--scope", "--voice", "--say", "--transcript",
        "--capabilities",
    ];
    if argv[0].starts_with('-') && !KNOWN.contains(&argv[0].as_str()) {
        eprintln!("quixi: unknown option `{}`\n", argv[0]);
        usage_with(2);
    }

    let resources = locate_resources();
    let engine = QuixiEngine::new(resources);

    // ── inspection commands: no model call, no cost ──
    // What this session can actually do — the same probe the UI uses to decide which
    // capabilities to hide. First thing to ask for in a bug report: it separates
    // "the capability is missing here" from "the backend failed".
    if argv[0] == "--capabilities" {
        match serde_json::to_string_pretty(&quixi_platform::linux::capabilities()) {
            Ok(rendered) => println!("{rendered}"),
            Err(e) => {
                eprintln!("quixi: could not render capabilities: {e}");
                std::process::exit(1);
            }
        }
        return;
    }

    if argv[0] == "--skills" {
        let skills = engine.list_local_skills();
        if skills.is_empty() {
            println!("no skills installed");
        }
        for s in skills {
            println!(
                "{}: {}",
                s.get("skillId").and_then(|v| v.as_str()).unwrap_or("?"),
                s.get("description").and_then(|v| v.as_str()).unwrap_or("")
            );
        }
        return;
    }

    if argv[0] == "--skill" {
        let Some(id) = argv.get(1) else {
            eprintln!("--skill needs an id; try --skills");
            std::process::exit(2);
        };
        match engine.get_local_skill_files(id) {
            files if files.is_empty() => {
                eprintln!("no skill named {id}");
                std::process::exit(1);
            }
            files => {
                for f in files {
                    if let Some(body) = f.get("content").and_then(|v| v.as_str()) {
                        print!("{body}");
                    } else if let (Some(name), Some(path)) = (
                        f.get("name").and_then(|v| v.as_str()),
                        f.get("path").and_then(|v| v.as_str()),
                    ) {
                        println!("── {name} ({path})");
                    }
                }
            }
        }
        return;
    }

    if argv[0] == "--search" {
        // Same code path the model hits through the ListSkills tool, so this is a real check of
        // ranking and pagination rather than a mock of it.
        let query = argv
            .get(1)
            .filter(|a| !a.starts_with("--"))
            .cloned()
            .unwrap_or_default();
        let page = argv
            .iter()
            .position(|a| a == "--page")
            .and_then(|i| argv.get(i + 1))
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1);
        let (out, _is_error) =
            engine.list_skills_tool(&serde_json::json!({"query": query, "page": page}));
        println!("{out}");
        return;
    }

    if argv[0] == "--remember" {
        // quixi --remember <wing> <room> <name>   (content on stdin)
        let (Some(wing), Some(room), Some(name)) = (argv.get(1), argv.get(2), argv.get(3)) else {
            eprintln!("usage: quixi --remember <wing> <room> <name>   (content on stdin)");
            std::process::exit(2);
        };
        let mut content = String::new();
        if std::io::Read::read_to_string(&mut std::io::stdin(), &mut content).is_err() {
            eprintln!("could not read content from stdin");
            std::process::exit(2);
        }
        let (out, err) = engine.remember_tool(&serde_json::json!({
            "wing": wing, "room": room, "name": name, "content": content
        }));
        if err {
            eprintln!("{out}");
            std::process::exit(1);
        }
        println!("{out}");
        return;
    }

    if argv[0] == "--recall" {
        let query = argv.get(1).cloned().unwrap_or_default();
        let limit = argv
            .iter()
            .position(|a| a == "--limit")
            .and_then(|i| argv.get(i + 1))
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(8);
        let (out, is_err) = engine.recall_tool(&serde_json::json!({
            "query": query, "limit": limit
        }));
        println!("{out}");
        if is_err {
            std::process::exit(1);
        }
        return;
    }

    if argv[0] == "--memory" {
        let (out, is_err) = engine.memory_index_tool();
        println!("{out}");
        if is_err {
            std::process::exit(1);
        }
        return;
    }

    if argv[0] == "--scope" {
        // Which memory tier the active provider allows, without spending a call.
        let local = engine.memory_provider_is_local();
        let st = engine.provider_manager.state.read();
        println!("provider:      {}", st.active_provider);
        println!("memory scope:  {}", if local { "FULL (provider is local)" } else { "RESTRICTED (provider is remote)" });
        if !local {
            println!("recallable:    {}", quixi_engine::QuixiEngine::REMOTE_SAFE_WINGS.join(", "));
        }
        return;
    }

    if argv[0] == "--voice" {
        let cfg = quixi_engine::voice::VoiceConfig::load(&engine.data_dir);
        println!("{}", serde_json::to_string_pretty(&cfg.to_json()).unwrap_or_default());
        println!("{}", serde_json::to_string_pretty(&quixi_engine::voice::status(&cfg)).unwrap_or_default());
        return;
    }

    if argv[0] == "--say" {
        let dry = argv.iter().any(|a| a == "--dry-run");
        let text: Vec<&str> = argv[1..].iter().filter(|a| !a.starts_with("--")).map(|s| s.as_str()).collect();
        let text = text.join(" ");
        let cfg = quixi_engine::voice::VoiceConfig::load(&engine.data_dir);
        if text.trim().is_empty() {
            eprintln!("usage: quixi --say \"text\" [--dry-run]");
            std::process::exit(2);
        }
        if dry {
            // Fetch and pad without making noise: proves the endpoint and the lead-in path.
            match &cfg.tts {
                quixi_engine::voice::Tts::Kokoro { url, voice, speed } => {
                    match quixi_engine::voice::fetch_for_test(url, voice, *speed, &text) {
                        Ok(wav) => {
                            let padded = quixi_engine::voice::with_lead_in(&wav, 250)
                                .unwrap_or_else(|| wav.clone());
                            println!(
                                "kokoro ok: {} bytes, lead-in padded to {} bytes (+{} ms)",
                                wav.len(),
                                padded.len(),
                                250
                            );
                        }
                        Err(e) => {
                            eprintln!("{e}");
                            std::process::exit(1);
                        }
                    }
                }
                other => println!("backend {other:?} has no dry-run; it would run a command"),
            }
            return;
        }
        match quixi_engine::voice::speak(&cfg, &text, 250) {
            Ok(()) => println!("spoken"),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        }
        return;
    }

    if argv[0] == "--transcript" {
        let cfg = quixi_engine::voice::VoiceConfig::load(&engine.data_dir);
        match quixi_engine::voice::transcript(&cfg) {
            Ok(t) if t.is_empty() => println!("(nothing transcribed yet)"),
            Ok(t) => println!("{t}"),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        }
        return;
    }

    if argv[0] == "--prompt-block" {
        // Exactly what the model is told about the skill library, and what it costs to build it.
        // Useful when the library grows and the per-turn overhead needs checking.
        let t0 = std::time::Instant::now();
        let block = engine.skills_index_block();
        let elapsed = t0.elapsed();
        println!("{}", block.trim());
        eprintln!("[cost] built in {:.1} ms", elapsed.as_secs_f64() * 1000.0);
        return;
    }

    if argv[0] == "--providers" {
        let st = engine.provider_manager.state.read();
        println!("active provider: {}", st.active_provider);
        println!("active model:    {}", st.active_model);
        println!("subagent:        {} / {}", st.subagent_provider, st.subagent_model);
        for p in st.providers.iter() {
            println!(
                "  {:<12} {:<28} {}",
                p.id,
                p.base_url,
                if p.configured { "configured" } else { "not configured" }
            );
        }
        return;
    }

    // ── a real turn ──
    let mut json_out = false;
    let mut cwd = std::env::current_dir()
        .map(|d| d.to_string_lossy().into_owned())
        .unwrap_or_else(|_| ".".to_string());
    let mut prompt_parts: Vec<String> = Vec::new();

    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "--json" => json_out = true,
            "--cwd" => {
                i += 1;
                if i < argv.len() {
                    cwd = argv[i].clone();
                }
            }
            other => prompt_parts.push(other.to_string()),
        }
        i += 1;
    }

    let prompt = prompt_parts.join(" ");
    if prompt.trim().is_empty() {
        usage_with(2);
    }

    let session_id = format!("headless-{}", uuid::Uuid::new_v4());
    let cancelled = AtomicBool::new(false);

    let mut printed_any = false;
    let (reply, model) = engine.generate_reply_with_tools_streaming(
        &prompt,
        &cwd,
        &[],
        None,
        "default",
        &session_id,
        &cancelled,
        |chunk| match chunk {
            // Streaming output goes to stdout so it can be piped; reasoning goes to stderr so it
            // does not contaminate the answer.
            StreamChunk::Text(t) => {
                if !json_out {
                    print!("{t}");
                    let _ = std::io::stdout().flush();
                    printed_any = true;
                }
            }
            StreamChunk::Thinking(t) => {
                if !json_out {
                    eprint!("{t}");
                }
            }
        },
        |envelope| {
            // Tool activity goes to stderr so the answer streams cleanly on stdout. The engine
            // hands back a message envelope whose content is a list of blocks, not OpenAI-style
            // tool_calls - reading the wrong path is why this printed nothing.
            if json_out {
                return;
            }
            let Some(blocks) = envelope
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
            else {
                return;
            };
            for block in blocks {
                if block.get("type").and_then(|v| v.as_str()) != Some("tool_use") {
                    continue;
                }
                let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("?");
                let detail = block
                    .get("input")
                    .map(|i| {
                        let s = i.to_string();
                        if s.len() > 90 { format!("{}…", &s[..90]) } else { s }
                    })
                    .unwrap_or_default();
                eprintln!("[tool] {name} {detail}");
            }
        },
    );

    if json_out {
        println!(
            "{}",
            serde_json::json!({"model": model, "session": session_id, "reply": reply})
        );
    } else if !printed_any {
        // Some providers return the whole answer without streaming; print it rather than nothing.
        println!("{reply}");
    } else {
        println!();
    }
}
