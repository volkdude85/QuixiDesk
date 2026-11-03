/* Copyright (c) 2026 QuixiAI. MIT license. */
(() => {
  "use strict";

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const configError = (result) => {
    if (result?.error) throw new Error(typeof result.error === "string" ? result.error : result.error.message || "The request failed.");
    return result;
  };
  function readStringMap(value, label) {
    let parsed;
    try { parsed = JSON.parse(value.trim() || "{}"); }
    catch { throw new Error(`${label} must be a JSON object with text values.`); }
    if (!isObject(parsed) || Object.values(parsed).some((value) => typeof value !== "string"))
      throw new Error(`${label} must be a JSON object with text values.`);
    return parsed;
  }
  function validateName(name) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(name) || ["constructor", "prototype", "__proto__"].includes(name))
      throw new Error("Use a name of up to 80 letters, numbers, dots, underscores or hyphens, starting with a letter or number.");
    return name;
  }
  function remoteUrl(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error("Enter the server’s full http:// or https:// URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error("Use an HTTP or HTTPS URL without a password or fragment. Put authentication headers in Advanced options.");
    return url.href;
  }

  function create(ctx) {
    const { el, button, field, select, dialog, confirmDialog, header, plainBody, toast, rpc, api } = ctx;
    let activeRecognition = null;
    let speechGeneration = 0;
    let speakingText = null;
    const speechControls = new Set();

    async function getConfig() {
      const config = configError(await rpc("MCP", "getMcpServersConfig", [], "quixi.settings"));
      if (!isObject(config)) throw new Error("Connection configuration could not be read. Nothing was changed.");
      return config;
    }
    async function saveConfig(config) {
      const result = configError(await rpc("MCP", "setMcpServerConfigs", [config], "quixi.settings"));
      if (result?.ok !== true) throw new Error("The connection configuration was not saved.");
      await ctx.reloadTools();
    }
    async function changeConnection(name, change) {
      const config = await getConfig();
      if (!Object.hasOwn(config, name)) throw new Error("This connection was removed. Refresh the page and try again.");
      const next = change(config[name]);
      if (next === undefined) delete config[name]; else config[name] = next;
      await saveConfig(config);
    }
    function removeConnection(name) {
      confirmDialog("Remove connection?", `Remove “${name}” from QuixiDesk? This does not uninstall the server or delete its files.`,
        () => changeConnection(name, () => undefined), "Remove connection");
    }

    async function connectionEditor(name = null) {
      const initial = await getConfig();
      if (name !== null && !Object.hasOwn(initial, name)) throw new Error("This connection no longer exists.");
      const original = name === null ? undefined : initial[name];
      const entry = isObject(original) ? original : {};
      const legacy = name !== null && ctx.getToolsData().servers?.some((server) => server.name === name && server.error?.kind === "unsupported");
      const baseline = JSON.stringify(original);
      const nameInput = el("input", { value: name || "", placeholder: "my-connection", disabled: name !== null, autocomplete: "off" });
      const kind = entry.transport || (entry.url ? "http" : "stdio");
      const unsupported = !["stdio", "http", "sse"].includes(kind);
      const transport = select([["http", "Remote server (HTTP)"], ["stdio", "Local command"], ["sse", "Remote server (legacy SSE)"]], unsupported || legacy ? "http" : (name === null ? "http" : kind), () => updateTransport());
      const urlInput = el("input", { type: "url", value: entry.url || "", placeholder: "https://service.example/mcp", autocomplete: "off", spellcheck: "false" });
      const command = el("input", { value: entry.command || "", placeholder: "npx", autocomplete: "off", spellcheck: "false" });
      const argsHost = el("div", { class: "connection-arguments" });
      const argumentInputs = [];
      function addArgument(value = "") {
        const input = el("input", { value, "aria-label": "Command argument", placeholder: "One argument, for example -y", spellcheck: "false" });
        const row = el("div", { class: "row" }, input, button("Remove", () => { argumentInputs.splice(argumentInputs.indexOf(input), 1); row.remove(); }, "quiet"));
        argumentInputs.push(input); argsHost.append(row); return input;
      }
      (Array.isArray(entry.args) ? entry.args : []).forEach(addArgument);
      const env = el("textarea", { value: JSON.stringify(entry.env || {}, null, 2), rows: 4, spellcheck: "false" });
      const headers = el("textarea", { value: JSON.stringify(entry.headers || {}, null, 2), rows: 4, spellcheck: "false" });
      const cwd = el("input", { value: entry.cwd || "", placeholder: "Use the task’s folder", spellcheck: "false" });
      const enabled = el("input", { type: "checkbox", checked: entry.enabled !== false });
      const local = el("div", { class: "connection-local" }, field("Command", command, "The executable to start. Arguments are separate below; shell syntax is not evaluated."),
        el("label", {}, "Arguments"), argsHost, button("Add argument", () => addArgument().focus(), "quiet"),
        el("p", { class: "hint" }, "Local servers run with your account’s permissions. Only add commands you trust."));
      const remote = el("div", { class: "connection-remote" }, field("Server URL", urlInput, "Use the MCP endpoint supplied by the service. If it requires sign-in, the connection will offer Sign in after discovery."));
      const localAdvanced = el("div", {}, field("Working folder (optional)", cwd), field("Environment variables (JSON)", env));
      const remoteAdvanced = el("div", {}, field("HTTP headers (JSON)", headers, "Optional. Header values are stored in the local connection configuration."));
      const advanced = el("details", {}, el("summary", {}, "Advanced options"), localAdvanced, remoteAdvanced,
        el("p", { class: "hint" }, "Other existing options, tool restrictions and timeouts are preserved. Use Advanced JSON on the connections page to edit them."));
      const error = el("p", { class: "error-text", role: "alert", hidden: true });
      const save = button("Save connection", submit, "primary");
      const modal = dialog(name === null ? "Add connection" : `Edit ${name}`, [
        name !== null && !isObject(original) ? el("p", { class: "notice" }, "This connection has invalid configuration. Saving this form replaces that invalid entry.") : null,
        unsupported ? el("p", { class: "notice" }, "This transport is not supported by the form. Choose a supported transport or edit Advanced JSON.") : null,
        legacy ? el("p", { class: "notice" }, "This legacy connector is unavailable. Replace it with the URL or command of a working MCP server, or remove the connection.") : null,
        field("Connection name", nameInput), field("Connection type", transport), remote, local, advanced,
        el("label", { class: "mcp-checkbox" }, enabled, "Enable this connection"), error,
        el("div", { class: "form-actions" }, button("Cancel", () => modal.close(), "quiet"), save),
      ]);
      function updateTransport() {
        const isLocal = transport.value === "stdio";
        local.hidden = !isLocal; remote.hidden = isLocal;
        localAdvanced.hidden = !isLocal; remoteAdvanced.hidden = isLocal;
      }
      updateTransport();
      async function submit() {
        error.hidden = true; save.disabled = true;
        try {
          const key = validateName(nameInput.value.trim());
          const next = { ...entry, transport: transport.value, enabled: enabled.checked };
          if (transport.value === "stdio") {
            if (!command.value.trim()) throw new Error("Enter the command that starts this server.");
            next.command = command.value.trim(); next.args = argumentInputs.map((input) => input.value);
            next.env = readStringMap(env.value, "Environment variables");
            if (cwd.value.trim()) next.cwd = cwd.value.trim(); else delete next.cwd;
            delete next.url; delete next.headers;
          } else {
            next.url = remoteUrl(urlInput.value); next.headers = readStringMap(headers.value, "HTTP headers");
            delete next.command; delete next.args; delete next.env; delete next.cwd;
          }
          // Re-read to preserve unrelated changes and refuse to overwrite an edit made elsewhere.
          const latest = await getConfig();
          if (name === null && Object.hasOwn(latest, key)) throw new Error("That connection name already exists. Choose another name.");
          if (name !== null && JSON.stringify(latest[name]) !== baseline)
            throw new Error("This connection changed while you were editing it. Close this dialog and reopen it to review the latest settings.");
          latest[key] = next;
          await saveConfig(latest); modal.close();
          toast("Connection saved. Its status shows whether discovery is complete.");
        } catch (problem) { error.textContent = problem.message; error.hidden = false; }
        finally { save.disabled = false; }
      }
      return modal;
    }

    function enhanceConnections() {
      const list = document.getElementById("mcp-connections");
      if (!list) return;
      const servers = ctx.getToolsData().servers || [];
      for (const row of list.querySelectorAll("[data-server]")) {
        const server = servers.find((value) => value.name === row.dataset.server);
        if (!server || (server.builtin && server.error?.kind !== "unsupported")) continue;
        const management = row.querySelector(".connection-management");
        if (management) {
          management.querySelector(".connection-toggle").textContent = server.status === "disabled" ? "Enable" : "Disable";
          continue;
        }
        row.append(el("div", { class: "connection-management row" },
          button(server.error?.kind === "unsupported" ? "Replace connection" : "Edit connection", () => connectionEditor(server.name), "quiet"),
          button(server.status === "disabled" ? "Enable" : "Disable", async () => {
            await changeConnection(server.name, (value) => {
              if (!isObject(value)) throw new Error("Edit this invalid connection before enabling or disabling it.");
              return { ...value, enabled: value.enabled === false };
            });
          }, "quiet connection-toggle"),
          button("Remove", () => removeConnection(server.name), "quiet")));
      }
    }
    async function readSkill(skill) {
      const files = configError(await rpc("LocalAgentModeSessions", "getLocalSkillFiles", [skill.skillId || skill.name]));
      if (!Array.isArray(files) || !files.length) throw new Error("This skill’s instructions could not be loaded.");
      return files;
    }
    // Two libraries, two searches.
    //
    // QuixiDesk ships a small set of its own tools and skills. The Hermes roots are discovered by
    // convention, so this machine also carries the agent's whole procedural library — hundreds of
    // skills, named area/name. Mixing them in one list made the smaller set look like the whole
    // thing and buried the larger one.
    function skillArea(skill) {
      const id = String(skill.skillId || skill.name || "");
      const slash = id.indexOf("/");
      return slash > 0 ? id.slice(0, slash) : "";
    }
    function skillList(skills, query, areas) {
      const needle = query.trim().toLocaleLowerCase();
      const matched = skills.filter((skill) => {
        const hay = `${skill.displayName || ""} ${skill.skillId || skill.name || ""} ${skill.description || ""} ${skillArea(skill)}`;
        if (needle && !hay.toLocaleLowerCase().includes(needle)) return false;
        if (areas && areas.size && !areas.has(skillArea(skill) || "misc")) return false;
        return true;
      });
      return matched;
    }
    function skillCard(skill, names) {
      return el("article", { class: "card skill-card" },
        el("h3", {}, skill.displayName || names[skill.name] || skill.name),
        skillArea(skill) ? el("span", { class: "tag" }, skillArea(skill)) : null,
        el("p", {}, skill.description || "Instructions for a task workflow."),
        button("Try in a new instance", async () => { const files = await readSkill(skill); await ctx.startSkill(skill, files); }, "primary"),
        button("Read instructions", async () => {
          const files = await readSkill(skill);
          dialog(skill.displayName || skill.name, files.map((file) => el("details", { open: file.path === "SKILL.md" }, el("summary", {}, file.path),
            el("pre", { class: "skill-file" }, file.content))));
        }, "quiet"));
    }
    function skillPanel(title, blurb, skills) {
      const query = el("input", { type: "search", placeholder: `Search ${title}`, "aria-label": `Search ${title}` });
      const areaBar = el("div", { class: "area-bar" });
      const results = el("div", { class: "cards" });
      const count = el("p", { class: "hint", role: "status" });
      const areas = new Set();
      const allAreas = [...new Set(skills.map((s) => skillArea(s) || "misc"))].sort();
      const drawAreas = () => {
        areaBar.replaceChildren(
          button("All", () => { areas.clear(); drawAreas(); draw(); }, areas.size ? "quiet" : "quiet active"),
          ...allAreas.slice(0, 18).map((area) =>
            button(`${area}`, () => { areas.has(area) ? areas.delete(area) : areas.add(area); drawAreas(); draw(); },
              "quiet" + (areas.has(area) ? " active" : ""))));
      };
      const draw = () => {
        const matched = skillList(skills, query.value, areas);
        count.textContent = `${matched.length} of ${skills.length}`;
        results.replaceChildren(...matched.map((s) => skillCard(s, {})));
      };
      query.addEventListener("input", draw);
      drawAreas(); draw();
      return el("section", { class: "skill-library" },
        el("div", { class: "row" }, el("h2", { class: "grow" }, title), count),
        el("p", { class: "muted" }, blurb),
        allAreas.length > 1 ? areaBar : null,
        query, results);
    }
    function skillsSection(skills) {
      const isHermes = (s) => skillArea(s) !== "";
      const own = skills.filter((s) => !isHermes(s));
      const hers = skills.filter(isHermes);
      return el("div", { class: "skill-libraries" },
        skillPanel("QuixiDesk tools & skills",
          "What ships with this app: the bundled skills plus anything in your data directory.",
          own),
        skillPanel("Hermes",
          "Your agent's own procedural library, discovered from the Hermes profiles on this machine and grouped by area.",
          hers));
    }
    // One search across connections, the tools inside them, and skills. Skills had a filter of their
    // own and connections had none, so finding a tool you had already configured meant reading every
    // card on the page.
    function toolsFilter() {
      const input = el("input", {
        type: "search", class: "tools-search",
        placeholder: "Search connections, tools and skills",
        "aria-label": "Search connections, tools and skills",
      });
      const status = el("p", { class: "hint", role: "status" });
      const apply = () => {
        const needle = input.value.trim().toLocaleLowerCase();
        let shown = 0;
        let total = 0;
        for (const node of document.querySelectorAll("#mcp-connections [data-server], .cards .skill-card")) {
          total += 1;
          const hit = !needle || node.textContent.toLocaleLowerCase().includes(needle);
          node.hidden = !hit;
          if (hit) shown += 1;
        }
        status.textContent = needle ? `${shown} of ${total} match "${input.value.trim()}"` : "";
      };
      input.addEventListener("input", apply);
      // both lists are drawn after this renders, so re-apply when the DOM changes
      new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
      return el("div", { class: "tools-filter" }, input, status);
    }
    function renderTools(host) {
      const data = ctx.getToolsData();
      host.replaceChildren(header("Tools & skills", "Connect services and start tasks with reusable instructions."),
        toolsFilter(),
        el("div", { class: "row" }, el("h2", { class: "grow" }, "Connections"),
          button("Add connection", () => connectionEditor(), "primary"), button("Advanced JSON", ctx.advancedMcpEditor, "quiet")),
        el("p", { class: "muted" }, "Ready means initialization and tool discovery completed. Sign-in requests, failures and last-known catalogs stay visible."),
        el("p", { id: "mcp-load-error", class: "error-text", role: "alert", hidden: !data.error }, data.error || ""),
        el("div", { id: "mcp-connections", class: "mcp-connections" }), el("hr"), skillsSection(data.skills || []));
      ctx.updateMcpConnections(); enhanceConnections();
    }

    // The webview provides no Web Speech API on Linux, so the engine offers voice over HTTP.
    // Probe once; until the answer arrives, fall back to what the webview reports.
    const engineVoice = { tts: false, stt: false, probed: false };
    Promise.resolve(rpc("Voice", "getStatus"))
      .then((s) => { engineVoice.tts = !!s?.tts?.available; engineVoice.stt = !!s?.stt?.available; engineVoice.probed = true; })
      .catch(() => { engineVoice.probed = true; });
    const webviewSpeech = () => typeof window.SpeechSynthesisUtterance === "function" && typeof window.speechSynthesis?.speak === "function";
    function speechSupported() { return engineVoice.tts || webviewSpeech(); }
    function syncSpeechControls() {
      for (const control of speechControls) {
        if (!control.node.isConnected) { speechControls.delete(control); continue; }
        control.node.textContent = speakingText === control.text ? "Stop reading" : "Read aloud";
        control.node.setAttribute("aria-pressed", String(speakingText === control.text));
      }
    }
    function stopSpeaking() { speechGeneration++; speakingText = null; window.speechSynthesis?.cancel(); syncSpeechControls(); }
    function readAloudControl(text) {
      if (!speechSupported() || !text?.trim()) return null;
      const node = button(speakingText === text ? "Stop reading" : "Read aloud", () => {
        if (speakingText === text) { stopSpeaking(); return; }
        stopSpeaking(); speakingText = text; const generation = speechGeneration;
        const chunks = text.match(/[\s\S]{1,900}(?:\s|$)|[\s\S]{1,900}/g) || [text];
        const next = () => {
          if (generation !== speechGeneration) return;
          const part = chunks.shift();
          if (!part) { speakingText = null; syncSpeechControls(); return; }
          if (engineVoice.tts) {
            // One chunk in flight at a time: the endpoint answers when playback finishes, so
            // ordering holds and "stop reading" takes effect between chunks.
            Promise.resolve(rpc("Voice", "speak", [part]))
              .then((res) => { if (generation !== speechGeneration) return; if (!res || res.ok === false) { stopSpeaking(); toast("Read aloud could not play: " + String(res?.error || "check the voice endpoint and audio output.").split("\n")[0], true); return; } next(); })
              .catch(() => { if (generation === speechGeneration) { stopSpeaking(); toast("Read aloud could not reach the voice service.", true); } });
            return;
          }
          const utterance = new window.SpeechSynthesisUtterance(part);
          utterance.onend = next;
          utterance.onerror = (event) => { if (generation !== speechGeneration) return; stopSpeaking(); if (!["canceled", "interrupted"].includes(event.error)) toast("Read aloud could not play. Check your system voice and audio settings.", true); };
          window.speechSynthesis.speak(utterance);
        };
        syncSpeechControls(); next();
      }, "quiet");
      node.setAttribute("aria-pressed", String(speakingText === text));
      speechControls.add({ node, text });
      return node;
    }
    const recognitionConstructor = () => window.SpeechRecognition || window.webkitSpeechRecognition;
    function dictationControl(textarea) {
      const node = button("Dictate", () => {
        if (activeRecognition) { activeRecognition.stop(); return; }
        if (engineSttStop) { engineSttStop(); return; }
        const Recognition = recognitionConstructor();
        if (typeof Recognition === "function") {
        const notice = dialog("Dictate into your prompt", [el("p", {}, "Your webview’s speech service will transcribe your microphone. Depending on the platform, audio may be processed by an online speech service. Review the text before sending."),
          button("Start dictation", () => { notice.close(); start(Recognition); }, "primary")]);
          return;
        }
        // No webview recogniser: WebKitGTK implements none of the Web Speech API, so there is
        // nothing to negotiate with. The engine owns the microphone — a streaming STT service or a
        // command — and polling it is the only path that exists. Waiting for a probe first meant a
        // slow or unreachable endpoint turned Dictate into a dialog telling a Linux user to use
        // macOS dictation.
        startEngineDictation(textarea, node);
      }, "quiet");
      node.title = typeof recognitionConstructor() === "function" ? "Dictate text into the prompt" : "System dictation help";
      function start(Recognition) {
        if (!textarea.isConnected) return;
        let recognition;
        try { recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = document.documentElement.lang || navigator.language || "en-US"; }
        catch { toast("Speech recognition could not start. Use your operating system’s dictation instead.", true); return; }
        activeRecognition = recognition;
        const cleanup = () => { if (activeRecognition === recognition) activeRecognition = null; node.textContent = "Dictate"; node.setAttribute("aria-pressed", "false"); };
        recognition.onstart = () => { node.textContent = "Stop dictation"; node.setAttribute("aria-pressed", "true"); };
        recognition.onresult = (event) => {
          if (activeRecognition !== recognition || !textarea.isConnected) { recognition.abort(); return; }
          const transcripts = [];
          for (let i = event.resultIndex || 0; i < event.results.length; i++) if (event.results[i].isFinal) transcripts.push(event.results[i][0].transcript);
          const spoken = transcripts.join(" ").trim(); if (!spoken) return;
          const at = textarea.selectionStart ?? textarea.value.length, end = textarea.selectionEnd ?? at;
          const prefix = at && !/\s/.test(textarea.value[at - 1]) ? " " : "";
          const suffix = end < textarea.value.length && !/\s/.test(textarea.value[end]) ? " " : "";
          textarea.setRangeText(prefix + spoken + suffix, at, end, "end");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        };
        recognition.onerror = (event) => {
          cleanup();
          const messages = { "not-allowed": "Microphone access was denied. Enable microphone permission in your operating system or use system dictation.", "audio-capture": "No usable microphone was found. Check your microphone connection and settings.", network: "The speech service could not connect. Check your network or use system dictation.", "no-speech": "No speech was detected. Try again when you are ready." };
          if (event.error !== "aborted") toast(messages[event.error] || "Dictation stopped. Your existing prompt is preserved.", true);
        };
        recognition.onend = cleanup;
        try { textarea.focus(); recognition.start(); } catch { cleanup(); toast("Speech recognition could not start. Use system dictation instead.", true); }
      }
      return node;
    }
    let engineSttStop = null;
    function startEngineDictation(textarea, node) {
      if (!textarea.isConnected || engineSttStop) return;
      node.textContent = "Stop dictation";
      node.setAttribute("aria-pressed", "true");
      let seen = "";
      let stopped = false;
      let warned = false;
      const cleanup = () => { stopped = true; engineSttStop = null; node.textContent = "Dictate"; node.setAttribute("aria-pressed", "false"); };
      engineSttStop = cleanup;
      const insert = (spoken) => {
        const at = textarea.selectionStart ?? textarea.value.length, end = textarea.selectionEnd ?? at;
        const prefix = at && !/\s/.test(textarea.value[at - 1]) ? " " : "";
        const suffix = end < textarea.value.length && !/\s/.test(textarea.value[end]) ? " " : "";
        textarea.setRangeText(prefix + spoken + suffix, at, end, "end");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      // The first read establishes the offset: anything already transcribed predates this prompt.
      const tick = async () => {
        if (stopped) return;
        if (!textarea.isConnected) { cleanup(); return; }
        try {
          const payload = await rpc("Voice", "getTranscript");
          if (payload && payload.error && !warned) {
            warned = true;
            toast("Dictation could not reach the speech service: " + String(payload.error).split("\n")[0], true);
          }
          const full = typeof payload?.transcript === "string" ? payload.transcript : "";
          if (!seen) { seen = full; }
          else if (full.length > seen.length) {
            const fresh = full.slice(seen.length).trim();
            seen = full;
            if (fresh) insert(fresh);
          } else if (full.length < seen.length) { seen = full; }
        } catch { /* bridge hiccup; keep polling while the control stays active */ }
        if (!stopped) setTimeout(tick, 700);
      };
      tick();
    }

    function stopAudio() {
      stopSpeaking();
      if (engineSttStop) engineSttStop();
      const recognition = activeRecognition; activeRecognition = null;
      if (recognition) try { recognition.abort(); } catch { /* Already ended. */ }
    }
    window.addEventListener("pagehide", stopAudio);
    async function renderDesktopStatus(host) {
      const status = el("p", { role: "status", class: "hint" }, "Reading application status…");
      host.append(el("section", { class: "desktop-status" }, el("h2", {}, "Application & audio"), status,
        el("p", {}, engineVoice.tts ? "Read aloud uses the configured voice backend." : speechSupported() ? "Read aloud is available on assistant messages through the system webview’s speech service." : "Read aloud is not available: no voice backend is configured and this webview has no speech service."),
        el("p", {}, typeof recognitionConstructor() === "function" ? "Dictation is available from the composer. The speech service may require network access and microphone permission." : engineVoice.stt ? "Dictation uses the configured speech-to-text backend; audio does not leave this machine." : "Dictation is not available: no speech-to-text backend is configured and this webview has no recogniser."),
        el("p", { class: "hint" }, "Keyboard shortcuts work while QuixiDesk is focused: Ctrl+N new task · Ctrl+K search · Ctrl+, settings."),
        button("View available releases", () => ctx.openExternal("https://github.com/QuixiAI/QuixiDesk/releases"), "quiet")));
      const results = await Promise.allSettled([rpc("AboutWindow", "getBuildProps"), api("/api/quixi/storage/status")]);
      if (!status.isConnected) return;
      const version = results[0].status === "fulfilled" ? results[0].value?.appVersion : null;
      const storage = results[1].status === "fulfilled" ? results[1].value : null;
      status.textContent = `${typeof version === "string" && version ? `QuixiDesk ${version}` : "Version unavailable"} · ${Array.isArray(storage?.issues) ? storage.issues.length ? "Storage needs attention — inspect Privacy & data before closing." : "No storage problems reported." : "Storage status unavailable."}`;
    }

    return { renderTools, enhanceConnections, connectionEditor, renderDesktopStatus, dictationControl, readAloudControl, stopAudio };
  }
  window.QuixiCapabilityWorkflows = { create };
})();
