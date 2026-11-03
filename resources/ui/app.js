/* Copyright (c) 2026 QuixiAI. MIT license. Original QuixiDesk workspace. */
(() => {
  "use strict";
  const { api, rpc, copy } = window.quixi;
  const root = document.getElementById("app");
  const state = {
    page: "new",
    id: null,
    sessions: [],
    pendingMessages: new Map(),
    projects: [],
    artifacts: [],
    schedules: [],
    providers: null,
    draft: "",
    attachments: [],
    folder: "",
    project: null,
    permission: "default",
    browser: false,
    browserState: null,
    streams: new Map(),
    transcripts: new Map(),
    drafts: new Map(),
    attachmentDrafts: new Map(),
    stopped: new Set(),
    approvals: new Map(),
    subagents: new Map(),
    collapsed: localStorage.getItem("quixi.sidebar") === "closed",
    settingsTab: "general",
  };
  const icons = {
    daemon: "M7.5 8.6C6.3 6.4 6.5 4.4 8.1 3.8M16.5 8.6c1.2-2.2 1-4.2-.6-4.8M6.5 10c0 4 2.5 7 5.5 7s5.5-3 5.5-7M9.6 12h.01M14.4 12h.01M10.4 15.4c1 .7 2.2.7 3.2 0",
    plus: "M12 5v14M5 12h14",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    projects: "M3 6h7l2 3h9v11H3zM3 6V4h7l2 2",
    artifacts: "M4 3h12l4 4v14H4zM8 12h8M8 16h5",
    schedule: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    // A saw blade: twelve teeth and a centre hole. It replaces a pencil with a line through it, which
    // read as "tools, disabled" rather than "tools".
    tools: "M12 3.9a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2 M20.10 12.00L21.66 14.16 M19.48 15.10L20.10 17.69 M17.73 17.73L17.30 20.36 M15.10 19.48L13.70 21.75 M12.00 20.10L9.84 21.66 M8.90 19.48L6.31 20.10 M6.27 17.73L3.64 17.30 M4.52 15.10L2.25 13.70 M3.90 12.00L2.34 9.84 M4.52 8.90L3.90 6.31 M6.27 6.27L6.70 3.64 M8.90 4.52L10.30 2.25 M12.00 3.90L14.16 2.34 M15.10 4.52L17.69 3.90 M17.73 6.27L20.36 6.70 M19.48 8.90L21.75 10.30 M12 10.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2",
    settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
    sidebar: "M3 4h18v16H3zM8 4v16",
    arrow: "M5 12h14M13 6l6 6-6 6",
    stop: "M6 6h12v12H6z",
    browser: "M3 4h18v16H3zM3 9h18M7 6h.01M10 6h.01",
    folder: "M3 6h7l2 3h9v11H3z",
    close: "M6 6l12 12M18 6L6 18",
    file: "M5 3h9l5 5v13H5zM14 3v6h5",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    check: "M4 12l5 5L20 6",
    back: "M15 5l-7 7 7 7",
    star: "M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
    code: "M8 6l-6 6 6 6M16 6l6 6-6 6",
    refresh: "M20 8a9 9 0 1 0 1 7M20 3v6h-6",
    spark: "M12 3v18M3 12h18M6 6l12 12M18 6L6 18",
    // Something attached from outside, rather than a pencil struck through — which is what this
    // button used to wear, and it read as "disabled" on a control that adds context.
    link: "M10 13.5a4.5 4.5 0 006.4 0l3.1-3.1a4.5 4.5 0 00-6.4-6.4l-1.4 1.4M14 10.5a4.5 4.5 0 00-6.4 0l-3.1 3.1a4.5 4.5 0 006.4 6.4l1.4-1.4",
      // Speaker glyphs. Filled-ish wave for on, crossed for off, so the state reads without a label.
    // A microphone, not the file glyph. `icon()` falls back to icons.file for any name it does not
    // know, so a missing "mic" key draws a sheet of paper — which is what it drew.
    mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7",
    micOff: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-4.5 2.6M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7M4 3l16 18",
    speaker: "M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
    speakerOff: "M4 9v6h4l5 4V5L8 9H4zM16 9l5 6M21 9l-5 6",
};
  function icon(name, size = 18) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    }))
      node.setAttribute(k, v);
    const path = document.createElementNS(node.namespaceURI, "path");
    path.setAttribute("d", icons[name] || icons.file);
    node.append(path);
    return node;
  }
  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on"))
        n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") n.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected")
        n[k] = !!v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const child of children.flat(Infinity))
      if (child !== null && child !== undefined && child !== false)
        n.append(
          child instanceof Node
            ? child
            : document.createTextNode(String(child)),
        );
    return n;
  }

  // Which build this is. The app sets it on the page before the shell loads; a stock
  // build never sets it, so this is "" and every label below disappears.
  const EDITION = window.__QUIXI_EDITION__ || "";
  // True only in a build that was started with QUIXI_DEVELOPER=1. The engine decides; the shell obeys.
  const IS_DEVELOPER = window.__QUIXI_DEVELOPER__ === true;
  // Which of the two things is on screen. The local build carries the owner's persona, memory and
  // keys; this one ships to GitHub and carries none of them. That difference is worth a badge, not
  // just a subtle prefix, because the two windows look identical otherwise.
  const PUBLISHED = /github/i.test(EDITION);
  function button(label, fn, cls = "", name) {
    return el(
      "button",
      {
        type: "button",
        class: cls,
        onClick: async (event) => {
          try {
            await fn(event);
          } catch (e) {
            toast(e.message, true);
          }
        },
      },
      name ? icon(name) : null,
      label,
    );
  }
  const ib = (label, name, fn) => {
    const b = button("", fn, "icon quiet", name);
    b.setAttribute("aria-label", label);
    b.title = label;
    return b;
  };
  function toast(text, error = false) {
    const n = el("div", { class: "toast" + (error ? " error" : "") }, text);
    document.getElementById("toasts").append(n);
    setTimeout(() => n.remove(), 6500);
  }
  function select(options, value, change, attrs = {}) {
    const n = el("select", {
      ...attrs,
      onChange: (e) => change?.(e.target.value),
    });
    for (const [v, label] of options)
      n.append(
        el(
          "option",
          { value: v, selected: String(v) === String(value) },
          label,
        ),
      );
    return n;
  }
  function field(label, control, hint) {
    const id = "field-" + crypto.randomUUID();
    control.id = id;
    return el(
      "div",
      {},
      el("label", { for: id }, label),
      control,
      hint ? el("div", { class: "hint" }, hint) : null,
    );
  }
  function empty(title, description, action) {
    return el(
      "div",
      { class: "empty" },
      icon("spark", 28),
      el("h2", {}, title),
      el("p", {}, description),
      action,
    );
  }
  function date(ms) {
    return ms
      ? new Date(ms).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "";
  }
  function project() {
    return state.projects.find((p) => p.id === state.project);
  }
  function service(s) {
    return s?._kind === "code" ? "LocalSessions" : "LocalAgentModeSessions";
  }
  function session() {
    return state.sessions.find((s) => s.sessionId === state.id);
  }
  function running(s) {
    return s?._kind === "code" ? !!s.turnRunning : !!s?.isRunning;
  }
  function draftKey() {
    return state.page === "chat" ? state.id : "new:" + (state.project || "personal");
  }
  function saveDraft() {
    const input=document.getElementById("prompt");
    if(!input)return;
    const key=input.dataset.draftKey || draftKey();
    state.attachmentDrafts.set(key,state.attachments.slice());
    state.drafts.set(key,input.value);
    sessionStorage.setItem("quixi.draft."+key,input.value);
  }
  function getDraft() {
    return (
      state.drafts.get(draftKey()) ??
      sessionStorage.getItem("quixi.draft." + draftKey()) ??
      ""
    );
  }
  function currentFolder() {
    return (
      session() ? (session().userSelectedFolders?.[0] ?? session().cwd ?? "") : (state.folder || "")
    );
  }
  function dialog(title, body, { wide = false } = {}) {
    const opener = document.activeElement;
    const d = el("dialog", { class: wide ? "wide" : "" });
    d.append(
      el(
        "div",
        { class: "dialog-head" },
        el("h2", {}, title),
        ib("Close dialog", "close", () => d.close()),
      ),
      el("div", { class: "dialog-body" }, body),
    );
    d.addEventListener("close", () => { d.remove(); if(opener?.isConnected) opener.focus(); });
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    });
    document.body.append(d);
    d.showModal();
    d.setAttribute("aria-label", title);
    d.tabIndex = -1;
    const initialFocus =
      d.querySelector("input:not([type=hidden]), textarea, select") || d;
    initialFocus.focus();
    if (initialFocus instanceof HTMLTextAreaElement) {
      initialFocus.setSelectionRange(0, 0);
      initialFocus.scrollTop = 0;
    }
    return d;
  }
  function confirmDialog(title, text, action, label = "Delete") {
    let busy = false;
    const d = dialog(title, [
      el("p", {}, text),
      el(
        "div",
        { class: "form-actions" },
        button("Cancel", () => d.close(), "quiet"),
        button(
          label,
          async (event) => {
            if (busy) return;
            busy = true;
            const control = event.currentTarget;
            control.disabled = true;
            try {
              await action();
              d.close();
            } finally {
              busy = false;
              control.disabled = false;
            }
          },
          "danger",
        ),
      ),
    ]);
  }
  function formDialog(
    title,
    fields,
    save,
    { wide = false, submit = "Save" } = {},
  ) {
    const controls = {};
    const body = el("form", {});
    const error = el("div", { class: "form-error", role: "alert" });
    for (const f of fields) {
      let c;
      if (f.options) c = select(f.options, f.value, null, { name: f.name });
      else
        c = el(f.multiline ? "textarea" : "input", {
          name: f.name,
          type: f.type || "text",
          value: f.value || "",
          required: f.required,
          placeholder: f.placeholder || "",
          ...(f.attrs || {}),
        });
      controls[f.name] = c;
      body.append(field(f.label, c, f.hint));
    }
    const saveButton = el(
      "button",
      { type: "submit", class: "primary" },
      submit,
    );
    body.append(
      error,
      el(
        "div",
        { class: "form-actions" },
        button("Cancel", () => d.close(), "quiet"),
        saveButton,
      ),
    );
    body.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (saveButton.disabled) return;
      error.textContent = "";
      saveButton.disabled = true;
      try {
        await save(
          Object.fromEntries(
            Object.entries(controls).map(([k, v]) => [k, v.value]),
          ),
        );
        d.close();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        saveButton.disabled = false;
      }
    });
    const d = dialog(title, body, { wide });
    return d;
  }
  async function loadSessions() {
    const [a, b] = await Promise.all([
      rpc("LocalAgentModeSessions", "getAll"),
      rpc("LocalSessions", "getAll"),
    ]);
    state.sessions = [
      ...(a || []).map((s) => ({ ...s, _kind: "task" })),
      ...(b || []).map((s) => ({ ...s, _kind: "code" })),
    ].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    renderRecents();
  }
  async function loadProjects() {
    state.projects = (await rpc("CoworkSpaces", "getAllSpaces")) || [];
  }
  // Who is speaking, in the interface. The persona file names itself in its first heading, so the
  // label says the name of the persona that is actually loaded rather than the name of the app it is
  // running inside.
  function speakerName() {
    const n = state.persona && state.persona.name;
    return n && n !== "None loaded" ? n : "QuixiDesk";
  }
  // Which persona is loaded is backend state — a file on disk. The interface only displays it.
  async function loadPersona() {
    try {
      state.persona = await rpc("AppPreferences", "getPersona");
    } catch {
      state.persona = { name: "None loaded", loaded: false, path: "", content: "", bytes: 0 };
    }
  }
// ---- persona + providers chips -------------------------------------------------
// The top bar carried a bare "Nora" that navigated somewhere and did nothing else. What it needs to
// say instead: this IS the current persona, and here is what you can do about it.
//
// Two chips, each in a visible box with a caret, so it is obvious they are controls and obvious which
// is which: PERSONA (who is speaking) and MODEL (what is answering). Everything here uses RPC members
// that already exist — getPersona, setPersona, restoreShippedPersona, and the model picker — so this
// is an interface over real behaviour rather than a stub.
const PERSONA_GLYPH = "\u25D0"; // half-filled circle: a face, without a theatre mask in a dark UI
const MODEL_GLYPH = "\u25C9";

function chipMenu({ label, glyph, items = [], load, cls = "" }) {
  const btn = el(
    "button",
    { class: `chip-menu-btn ${cls}`, "aria-haspopup": "menu", "aria-expanded": "false" },
    el("span", { class: "chip-glyph", "aria-hidden": "true" }, glyph),
    el("span", { class: "chip-label" }, label),
    el("span", { class: "chip-caret", "aria-hidden": "true" }, "\u25BE"),
  );
  const menu = el("div", { class: "chip-menu", role: "menu", hidden: true });

  function fill(rows) {
    menu.replaceChildren();
    for (const it of rows) {
      if (it.sep) { menu.append(el("div", { class: "chip-menu-sep" })); continue; }
      menu.append(
        el(
          "button",
          {
            class: "chip-menu-item" + (it.checked ? " checked" : "") + (it.danger ? " danger" : ""),
            role: "menuitem",
            onclick: () => { close(); it.run(); },
          },
          el("span", { class: "chip-check", "aria-hidden": "true" }, it.checked ? "\u2713" : ""),
          el("span", { class: "chip-menu-text" }, it.label),
          it.note ? el("span", { class: "chip-menu-note" }, it.note) : null,
        ),
      );
    }
  }
  fill(items);
  const onOutside = (e) => { if (!wrap.contains(e.target)) close(); };
  function close() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside, true);
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      document.addEventListener("click", onOutside, true);
      if (load) {
        load().then((rows) => { if (!menu.hidden) fill(rows); }).catch(() => {});
      }
    }
  });
  const wrap = el("div", { class: "chip-wrap" }, btn, menu);
  return wrap;
}

// Deleting a persona is the one destructive thing in this menu, so it asks for the name rather than a
// click: the file is the persona, and a mis-click should not be able to remove who is speaking.
async function deletePersonaFlow() {
  const p = state.persona || {};
  if (!p.loaded) { toast("There is no persona loaded to delete.", true); return; }
  formDialog(
    `Delete persona \u201C${p.name}\u201D`,
    [
      { name: "confirm", label: `Type ${p.name} to confirm`, placeholder: p.name },
      { name: "path", label: "File", value: p.path || "~/.quixi/persona.md", readonly: true },
    ],
    async (values) => {
      if ((values.confirm || "").trim() !== p.name) {
        throw new Error("The name did not match. Nothing was deleted.");
      }
      const res = await rpc("AppPreferences", "setPersona", [""]);
      if (res && res.ok === false) throw new Error(res.error || "Could not delete the persona.");
      await loadPersona();
      render();
      toast(`Deleted "${p.name}". The shipped persona can be restored from the persona page.`);
    },
    { submit: "Delete persona", wide: true },
  );
}

async function restorePersonaFlow() {
  const current = (state.persona && state.persona.bytes) || 0;
  const ok = current === 0 || window.confirm(
    `Replace ${(state.persona && state.persona.path) || "the persona file"} (${current} bytes) with the one this build ships?`,
  );
  if (!ok) return;
  const res = await rpc("AppPreferences", "restoreShippedPersona", []).catch((e) => ({ ok: false, error: String(e) }));
  if (res && res.ok) {
    await loadPersona();
    render();
    toast(`Persona restored: ${res.name || "unnamed"}`);
  } else {
    toast(`Could not restore: ${(res && res.error) || "unknown error"}`, true);
  }
}

async function savePersonaAsFlow() {
  formDialog(
    "Save this persona to the shelf",
    [
      { name: "name", label: "Name", placeholder: "work-mode" },
      { name: "where", label: "Saves to", value: "~/.quixi/personas/<name>.md", readonly: true },
    ],
    async (values) => {
      const res = await rpc("AppPreferences", "savePersonaAs", [{ name: values.name || "" }]);
      if (!res || res.ok === false) throw new Error((res && res.error) || "Could not save the persona.");
      toast(`Saved as "${res.slug}" — the shelf now holds a copy.`);
      render();
    },
    { submit: "Save to shelf", wide: true },
  );
}

async function activatePersonaFlow(slug, name) {
  const res = await rpc("AppPreferences", "activatePersona", [{ slug }]);
  if (res && res.ok) {
    await loadPersona();
    render();
    toast(`Now speaking as "${res.name || name}"`);
  } else {
    toast(`Could not switch: ${(res && res.error) || "unknown error"}`, true);
  }
}

async function deletePersonaFromShelf(slug, name) {
  formDialog(
    `Delete \u201C${name}\u201D from the shelf?`,
    [
      { name: "confirm", label: `Type ${slug} to confirm`, placeholder: slug },
      { name: "note", label: "Removes", value: `~/.quixi/personas/${slug}.md`, readonly: true },
    ],
    async (values) => {
      if ((values.confirm || "").trim().toLowerCase() !== slug) {
        throw new Error("The name did not match. Nothing was deleted.");
      }
      const res = await rpc("AppPreferences", "deletePersona", [{ slug }]);
      if (!res || res.ok === false) throw new Error((res && res.error) || "Could not delete.");
      toast(`Deleted "${name}" from the shelf. Who is speaking has not changed.`);
      render();
    },
    { submit: "Delete from shelf", wide: true },
  );
}

function personaChip() {
  const p = state.persona || {};
  const name = p.loaded ? p.name : "No persona";
  return chipMenu({
    label: name,
    glyph: PERSONA_GLYPH,
    cls: "persona",
    // Read the folder when the menu opens, so a file the user dropped in with Dolphin shows up
    // without restarting the app.
    load: async () => {
      const shelf = await rpc("AppPreferences", "listPersonas").catch(() => null);
      const rows = [
        { label: `${name} — current persona`, checked: true, note: "who is speaking", run: () => navigate("persona") },
        { sep: true },
      ];
      const others = ((shelf && shelf.personas) || []).filter(
        (x) => x.name !== name || x.slug !== (p.slug || ""),
      );
      if (others.length === 0) {
        rows.push({ label: "The shelf is empty", run: () => savePersonaAsFlow() });
      }
      for (const x of others) {
        rows.push({
          label: x.name,
          note: `${x.slug} · ${x.bytes} B`,
          run: () => activatePersonaFlow(x.slug, x.name),
        });
      }
      rows.push(
        { sep: true },
        { label: "Save this one to the shelf…", note: "a copy you can switch back to", run: () => savePersonaAsFlow() },
        { label: "Open the persona file", note: p.path || "~/.quixi/persona.md", run: () => navigate("persona") },
        { label: "Open the personas folder", note: "Dolphin's problem now", run: () => rpc("AppPreferences", "revealPersonas") },
        { label: "Use the shipped persona", note: "Nora", run: () => restorePersonaFlow() },
        { sep: true },
      );
      for (const x of others) {
        rows.push({ label: `Delete “${x.name}”…`, danger: true, note: "asks you to type it", run: () => deletePersonaFromShelf(x.slug, x.name) });
      }
      return rows;
    },
  });
}

// Add a key without leaving the composer.
//
// The model chip sits where the question "which model?" is actually asked, so answering it there is
// the whole point; sending somebody to a providers page to paste a key and then walk back is the
// long way round to the same box. This saves through the same endpoint the provider settings use,
// tests it, and lands in the model list for that provider.
// A local provider has no key. Asking for one would be a form that cannot be filled in; the only
// question is whether something is listening on the port, so ask that and report the answer.
async function probeLocalProvider(provider) {
  const status = el("p", { class: "hint", role: "status" }, `Looking for ${provider.name}…`);
  const dlg = dialog(provider.name, [
    el("p", { class: "muted" }, `This one runs on this machine, so there is no key. QuixiDesk asks ${provider.baseUrl || "its port"} whether anything is listening.`),
    status,
  ]);
  try {
    const r = await api("/api/quixi/providers/test", { providerId: provider.id });
    await loadProviders();
    if (r && r.ok === false) {
      status.textContent = r.message || `Nothing answered at ${provider.baseUrl || "that port"}.`;
      const retry = button("Try again", async () => { dlg.close(); probeLocalProvider(provider); }, "reveal");
      status.after(retry);
      return;
    }
    dlg.close();
    modelPicker(provider.id);
  } catch (error) {
    status.textContent = `${provider.name} did not answer: ${error.message}`;
  }
}

async function addKeyFor(provider) {
  const keyInput = el("input", {
    type: "password",
    placeholder: provider.keyPlaceholder || "Paste the API key",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    "aria-label": `${provider.name} API key`,
  });
  const status = el("p", { class: "hint", role: "status" });
  let dlg = null;
  const saveBtn = button(
    "Save and load models",
    async () => {
      const key = keyInput.value.trim();
      if (!key) {
        status.textContent = "Paste the key first.";
        keyInput.focus();
        return;
      }
      saveBtn.disabled = true;
      status.textContent = "Saving…";
      try {
        const saved = await api("/api/quixi/providers/save", {
          providerId: provider.id,
          apiKey: key,
          selectedModel: provider.selectedModel || "",
          setAsActive: true,
        });
        if (saved.error) throw new Error(saved.error);
        status.textContent = "Testing the key and loading models…";
        let tested = null;
        try {
          tested = await api("/api/quixi/providers/test", { providerId: provider.id });
        } catch {}
        await loadProviders();
        dlg?.close();
        if (tested && tested.ok === false) {
          toast(`Key saved for ${provider.name}. ${tested.message || "The provider did not answer."}`, true);
        }
        modelPicker(provider.id);
      } catch (error) {
        status.textContent = `Could not save the key: ${error.message}`;
        saveBtn.disabled = false;
      }
    },
    "primary",
  );
  const body = [
    el(
      "p",
      { class: "muted" },
      `${provider.name} needs a key before it can answer. It is stored on this machine with the rest of the provider credentials — not in the memory folder, and not sent anywhere except to ${provider.name}.`,
    ),
    field("API key", keyInput),
    provider.docsUrl
      ? el(
          "p",
          { class: "hint" },
          button(["Where to get a key ↗"], (event) => {
            event.preventDefault();
            openExternal(provider.docsUrl);
          }, "quiet"),
        )
      : null,
    status,
    el("div", { class: "first-run-actions" }, saveBtn),
  ].filter(Boolean);
  dlg = dialog(`Add a key for ${provider.name}`, body);
  keyInput.focus();
}

function providersChip() {
  const st = state.providers || {};
  const list = st.providers || [];
  const active = list.find((x) => x.id === st.activeProvider);
  const label = active ? `${active.name}${st.activeModel ? " · " + st.activeModel : ""}` : "Choose model";
  const items = [{ label: "Providers & models", note: "opens the picker", run: () => modelPicker() }, { sep: true }];
  for (const p of list) {
    const isActive = p.id === st.activeProvider;
    const local = p.category === "local" || /localhost|127\.0\.0\.1/.test(p.baseUrl || "");
    items.push({
      label: p.name,
      checked: isActive,
      note: isActive
        ? st.activeModel || ""
        : p.configured
          ? "configured"
          : local
            ? "runs on this machine — no key"
            : "needs a key",
      run: () => {
        if (p.configured) return modelPicker(p.id);
        // A local server has no key to ask for: it either answers on its port or it does not.
        if (local) return probeLocalProvider(p);
        return addKeyFor(p);
      },
    });
  }
  return chipMenu({ label, glyph: MODEL_GLYPH, cls: "model", items });
}

  function personaChipLabel() {
    const p = state.persona;
    if (!p) return "Persona…";
    return p.loaded ? p.name : "No persona";
  }
  async function loadProviders() {
    state.providers = await api("/api/quixi/providers");
    if (state.providers.credentialStorageError) toast("Credentials could not be saved or unlocked: " + state.providers.credentialStorageError, true);
  }
  function navigate(page, id = null, { replace = false } = {}) {
    saveDraft();
    capabilityUI?.stopAudio();
    page = String(page).replace(/^\//, "");
    if (page.startsWith("chat/")) {
      id = page.slice(5);
      page = "chat";
    }
    if (page.startsWith("cowork/")) {
      id = page.slice(7);
      page = "chat";
    }
    if (page.startsWith("project/")) { id = decodeURIComponent(page.slice(8)); page = "project"; }
    if (page.startsWith("settings/")) page = "settings";
    const pages = [
      "new",
      "chat",
      "search",
      "projects",
      "project",
      "artifacts",
      "schedules",
      "daemons",
      "tasks",
      "tools",
      "settings",
      "setup",
      "onboarding",
    ];
    if (!pages.includes(page)) page = "new";
    if (page !== "tools") clearTimeout(toolsPollTimer);
    state.page = page;
    state.id = id;
    if (page === "project") { state.project=id; state.folder=state.projects.find(p=>p.id===id)?.folders?.[0]?.path||""; }
    if (page === "chat") {
      const opened = session();
      state.project = opened?.spaceId || null;
      state.folder = opened?.userSelectedFolders?.[0] ?? opened?.cwd ?? "";
    }
    state.attachments = state.attachmentDrafts.get(draftKey())?.slice() || [];
    const path =
      page === "chat" || page === "project" ? "/" + page + "/" + encodeURIComponent(id) : "/" + page;
    if (location.pathname !== path)
      history[replace ? "replaceState" : "pushState"]({}, "", path);
    render();
    if (page === "chat") openTranscript().catch((e) => toast(e.message, true));
    else if (page === "projects" || page === "project")
      loadProjects()
        .then(() => renderPage())
        .catch((e) => toast(e.message, true));
    else if (page === "artifacts") loadArtifacts();
    else if (page === "schedules") loadSchedules();
    else if (page === "tools") loadTools();
    else if (page === "search")
      setTimeout(() => document.getElementById("search-input")?.focus(), 0);
  }
  window.quixiNavigate = (page) => navigate(page);
  addEventListener("popstate", () => {
    const path = location.pathname.slice(1);
    navigate(path, null, { replace: true });
  });
  function render() {
    const navigationButton = (label, name, action, cls = "", page = "") => {
      const control = button(
        [icon(name), el("span", { class: "nav-label" }, label)],
        action,
        cls,
      );
      control.setAttribute("aria-label", label);
      control.title = label;
      // The rail in the stylesheet keys off these, and nothing was setting them, so the highlight
      // never appeared on any page.
      if (page) {
        control.dataset.page = page;
        if (state.page === page) {
          control.classList.add("active");
          control.setAttribute("aria-current", "page");
        }
      }
      return control;
    };
    // The shell is served by the app, which sets this before any script runs. A stock
    // build leaves it empty, so the name reads exactly as upstream's.
    document.title =
      state.page === "chat"
        ? (session()?.title || "Task") + " · " + EDITION + "QuixiDesk"
        : EDITION + "QuixiDesk";
    // Plural sections open. A list you cannot open is a label; a list you can open is a place.
    const nav = [
      ["search", "Search", "search"],
      ["projects", "Projects", "projects"],
      ["artifacts", "Artifacts", "artifacts"],
      ["schedules", "Cron jobs", "schedule"],
      ["daemons", "Daemons", "daemon"],
      ["tools", "Tools & skills", "tools"],
    ];
    // Every branch must have leaves. An expansion that opens onto nothing reads as broken, so each
    // group always carries at least one real row — the workspace for projects, the page itself for
    // the others — and says plainly when there is nothing stored yet.
    const GROUP_ITEMS = {
      projects: () => {
        const rows = [[state.project ? "This workspace" : "QuixiDesk workspace", () => navigate("projects")]];
        const projects = (state.projects || []).slice(0, 6).map((p) => [p.name, () => { state.project = p.id || p.name; navigate("project"); }]);
        return projects.length ? [...projects] : [...rows, ["No projects yet", () => navigate("projects")]];
      },
      artifacts: () => {
        const items = (state.artifacts || []).slice(0, 6).map((a) => [a.name || a.title, () => navigate("artifacts")]);
        return items.length ? items : [["No artifacts yet", () => navigate("artifacts")]];
      },
      schedules: () => {
        const items = (state.schedules || []).filter((s) => s.status !== "deleted").slice(0, 6)
          .map((s) => [s.displayName || s.name, () => navigate("schedules")]);
        return items.length ? items : [["No cron jobs yet", () => navigate("schedules")]];
      },
      tools: () => {
        // Connections exist by the time the sidebar draws; the skill index arrives later.
        const servers = (toolsData.servers || []).map((s) => [s.name, () => navigate("tools")]);
        const skills = (toolsData.skills || []).map((s) => [s.displayName || s.name, () => navigate("tools")]);
        const all = [...servers, ...skills].slice(0, 8);
        return all.length ? all : [["No connections yet", () => navigate("tools")]];
      },
    };
    const groupOpen = (page) => {
      try { return localStorage.getItem("quixi.group." + page) === "1" } catch { return false }
    };
    const setGroupOpen = (page, open) => {
      try { open ? localStorage.setItem("quixi.group." + page, "1") : localStorage.removeItem("quixi.group." + page) } catch {}
    };
    // A tree row, not a play button: the whole row is the hit target, the caret sits in its own
    // gutter so labels line up down the column, and children indent under it with a guide rail.
    // Caret points down when the row is closed (it opens downward) and up when it is open.
    function navigationGroup(page, label, ic, open, onToggle) {
      const caret = el("span", { class: "nav-caret" + (open ? " open" : ""), "aria-hidden": "true" });
      const toggle = el("button", {
        class: "nav-disclosure" + (open ? " open" : ""),
        "aria-expanded": String(open),
        "aria-label": (open ? "Collapse " : "Expand ") + label,
        title: (open ? "Collapse " : "Expand ") + label,
        onclick: (event) => { event.stopPropagation(); onToggle(); },
      }, caret);
      const items = open
        ? el("div", { class: "nav-children", role: "group", "aria-label": label },
            ...(GROUP_ITEMS[page]?.() || []).map(([name, onPick]) =>
              el("button", {
                class: "nav-child",
                tabindex: "0",
                onclick: onPick,
                onkeydown: (event) => {
                  // up/down walks the visible rows, as a list should
                  const rows = [...document.querySelectorAll(".nav-child, .nav-button, .nav-disclosure")];
                  const at = rows.indexOf(event.currentTarget);
                  const next = event.key === "ArrowDown" ? rows[at + 1] : event.key === "ArrowUp" ? rows[at - 1] : null;
                  if (next) { next.focus(); event.preventDefault(); }
                },
              }, String(name).slice(0, 40))))
        : null;
      return el("div", { class: "nav-group" + (open ? " is-open" : "") },
        el("div", { class: "nav-row" },
          toggle,
          navigationButton(label, ic, () => navigate(page), page, page)),
        items);
    }
    const sidebar = el(
      "aside",
      { class: "sidebar" },
      el(
        "div",
        { class: "brand" },
        el("img", { src: "/quixi-mark.svg", alt: "" }),
        el(
          "span",
          {},
          EDITION ? el("strong", { class: "edition-label" }, EDITION) : null,
          "QuixiDesk",
          // One short line. A 228px sidebar has no room for a sentence, and the long version pushed
          // the brand over the navigation below it.
          // The edition label above already says which copy this is. A second line underneath
          // spelling out where it came from is noise in a 228px sidebar, and "local · not
          // published" reads like a warning about the build rather than a fact about it.
          PUBLISHED
            ? el("span", { class: "brand-caption" }, el("b", { class: "edition-pill" }, "GITHUB"), " published")
            : null,
        ),
      ),
      el(
        "nav",
        { "aria-label": "Main navigation" },
        navigationButton(
          "New instance",
          "plus",
          () => {
            state.project = null;
            state.folder = "";
            navigate("new");
          },
          "new-task",
        ),
        ...nav.map(([page, label, ic]) =>
          GROUP_ITEMS[page]
            ? navigationGroup(page, label, ic, groupOpen(page), () => {
                setGroupOpen(page, !groupOpen(page));
                render();
              })
            : navigationButton(
            label,
            ic,
            () => navigate(page),
            state.page === page ? "active" : "",
          ),
        ),
      ),
      el("div", { class: "recent", id: "recents" }),
      el(
        "footer",
        {},
        // A way back into first run without wiping a profile. It gets its own row above Settings
        // rather than sitting beside it: it is not a peer of Settings, it is a development door, and
        // the row it shares with Settings made it look like one more nav item.
        // Development affordances: the key box and the door back into onboarding. A published build
        // ships neither — they are the tools of building it, and a stranger's install should not have
        // a paste-a-key-here box in the corner pretending to be a feature.
        IS_DEVELOPER ? el(
          "div",
          { class: "footer-rows" },
          // A key box that does the whole job. Paste, press Enter, and the app is configured: key
          // saved, provider active, model chosen, setup marked done. Nothing to click after the
          // paste, because a development helper that needs three more clicks is not a shortcut.
          (() => {
            const input = el("input", {
              id: "dev-key",
              type: "password",
              class: "dev-key-input",
              placeholder: "dev key",
              "aria-label": "Development API key for Ollama Cloud",
              autocomplete: "off",
              spellcheck: "false",
            });
            let busy = false;
            const configure = async () => {
              const key = input.value.trim();
              if (!key || busy) return;
              busy = true;
              input.disabled = true;
              try {
                const saved = await api("/api/quixi/providers/save", {
                  providerId: "ollama-cloud",
                  apiKey: key,
                  selectedModel: "deepseek-v4.1-flash:1017",
                  setAsActive: true,
                });
                if (saved && saved.error) throw new Error(saved.error);
                const done = await api("/api/quixi/providers/complete-onboarding", {
                  activeProvider: "ollama-cloud",
                  activeModel: "deepseek-v4.1-flash:1017",
                });
                if (done && done.error) throw new Error(done.error);
                await loadProviders();
                input.value = "";
                state.setupDismissed = true;
                navigate("new");
                toast("Ollama Cloud configured — deepseek-v4.1-flash:1017.");
              } catch (error) {
                toast(`Dev key failed: ${error.message}`, true);
              } finally {
                busy = false;
                input.disabled = false;
              }
            };
            // Paste and go: no Enter, no button. A key that has stopped arriving for half a second
            // is a key somebody finished entering.
            let typingTimer = null;
            input.addEventListener("input", () => {
              clearTimeout(typingTimer);
              if (input.value.trim().length < 8) return;
              typingTimer = setTimeout(configure, 600);
            });
            input.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                clearTimeout(typingTimer);
                configure();
              }
            });
            return input;
          })(),
          navigationButton(
            "Onboarding (development)",
            "spark",
            async () => {
              // Clears the keys as well as the questions. A first run with somebody's live API key
              // still in the store is not a first run — it is the old install wearing a wizard.
              const info = await rpc("Memory", "info").catch(() => null);
              const palace = (info && (info.path || info.defaultPath)) || "";
              // One button, and it means zero. Everything this app accumulates — credentials, the
              // active provider and model, the conversations, and the palace — goes, and the door
              // opens onto first run. The dialog names the palace path, because that is the one item
              // here somebody might not expect to lose.
              const ok = await new Promise((resolve) => {
                let answered = false;
                const dlg = dialog(
                  "Set everything back to zero?",
                  el(
                    "div",
                    { class: "browser-chooser" },
                    el("p", {}, "Clears every API key and OAuth token, unsets the active provider and model, deletes the conversations and artifacts, deletes the memory palace, and marks setup unanswered."),
                    palace ? el("p", { class: "muted" }, `Memory palace: ${palace}`) : null,
                    el("div", { class: "first-run-actions" },
                      button("Clear everything and open onboarding", () => {
                        answered = true;
                        resolve(true);
                        dlg.close();
                      }, "primary"),
                      button("Cancel", () => { answered = true; resolve(false); dlg.close(); }, "reveal"),
                    ),
                  ),
                );
                dlg.addEventListener("close", () => { if (!answered) resolve(false); });
              });
              if (!ok) return;
              try {
                const result = await api("/api/quixi/first-run/reset", {
                  clearSessions: true,
                  clearMemory: true,
                });
                await loadProviders();
                state.setupDismissed = false;
                state.sessions = [];
                palaceFolderCache = null;
                localStorage.removeItem("quixi.panelOpacity");
                navigate("onboarding");
                const gone = (result && result.removed) || [];
                const refused = (result && result.refused) || [];
                toast(refused.length
                  ? `Cleared, except ${refused.join(", ")} — it is outside this profile's home.`
                  : `Back to zero. ${gone.length} folder${gone.length === 1 ? "" : "s"} removed.`);
              } catch (e) {
                toast(`Could not reset: ${e.message}`, true);
              }
            },
            "quiet dev-entry",
          ),
        ) : null,
        navigationButton(
          "Settings",
          "settings",
          () => navigate("settings"),
          "quiet",
        ),
        ib("Toggle sidebar", "sidebar", () => {
          state.collapsed = !state.collapsed;
          localStorage.setItem(
            "quixi.sidebar",
            state.collapsed ? "closed" : "open",
          );
          render();
        }),
      ),
    );
    const crumb =
      state.page === "chat"
        ? session()?.title || "Task"
        : {
            new: "New instance",
            search: "Search",
            projects: "Projects",
            project: project()?.name || "Project",
            artifacts: "Private artifacts",
            schedules: "Cron jobs",
            daemons: "Daemons",
            tasks: "Tasks",
            tools: "Tools & skills",
            settings: "Settings",
          }[state.page];
    const top = el(
      "header",
      { class: "topbar" },
      // On an install with no history, "back" from the new-instance page is onboarding — there is
      // nothing behind it but the same page, and walking the browser history just runs out of
      // entries. So the arrow asks the gate rather than the history stack.
      ib("Back", "back", () => { if (needsOnboarding()) { state.setupDismissed = false; navigate("onboarding"); } else { history.back(); } }),
      el("div", { class: "crumb" }, el("strong", {}, crumb)),
      // Nothing to pick from yet. A model picker before a provider exists is a button that opens a
      // dead end, and first run is exactly when a person is most likely to press it.
      needsOnboarding() ? null : providersChip(),
      ib("Toggle QuixiDesk Browser", "browser", () => toggleBrowser()),
    );
    root.replaceChildren(
      el(
        "div",
        { class: "shell" + (state.collapsed ? " collapsed" : "") },
        sidebar,
        sidebarResizer(),
        el(
          "main",
          { class: "main" },
          top,
          el("div", {
            id: "page-host",
            class:
              state.page === "new" || state.page === "chat"
                ? "chat-layout"
                : "page",
          }),
        ),
      ),
    );
    root.removeAttribute("aria-busy");
    document.body.dataset.page = state.page;
    renderRecents();
    renderPage();
  }
  // One group per day, newest day first, each group saying how many conversations live in it.
  //
  // A flat "the last 35" answers "what did I touch most recently" and nothing else. The question
  // people actually ask their own history is "what was I doing on Tuesday", and the day is the unit
  // they ask it in. Same shape as the Sessions list in Hermes, so the two read alike.
  function dayKeyOf(ms) {
    const d = new Date(ms);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function dayLabelOf(key) {
    const [y, m, d] = key.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((midnight - day) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    const weekday = day.toLocaleDateString(undefined, { weekday: "long" });
    const rest = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return y === now.getFullYear() ? `${weekday} · ${rest}` : `${rest}, ${y}`;
  }
  function renderRecents() {
    const target = document.getElementById("recents");
    if (!target) return;
    const visible = state.sessions.filter((s) => !s.isArchived);
    const pinned = visible.filter((s) => s.isStarred);
    const byDay = new Map();
    for (const s of visible.filter((s) => !s.isStarred)) {
      const ms = s.lastActivityAt || s.createdAt || 0;
      const key = dayKeyOf(ms);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(s);
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    target.replaceChildren();
    const section = (label, list) =>
      target.append(
        el(
          "div",
          { class: "section-label" },
          el("span", {}, label),
          el("span", { class: "section-count" }, String(list.length)),
        ),
      );
    if (pinned.length) {
      section("Pinned", pinned);
      for (const s of pinned) target.append(recentRow(s));
    }
    for (const [key, list] of days) {
      list.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
      section(dayLabelOf(key), list);
      for (const s of list) target.append(recentRow(s));
    }
    if (!visible.length)
      target.append(
        el(
          "p",
          { class: "hint", style: "padding:0 10px" },
          "Your conversations will appear here.",
        ),
      );
  }
  function recentRow(s) {
    return el(
      "div",
      { class: "recent-row" + (state.id === s.sessionId ? " current" : "") },
      button(
        [
          running(s) ? el("span", { class: "running-dot" }) : null,
          s.title || "Untitled task",
        ],
        () => {
          state.project = s.spaceId || null;
          state.folder = s.cwd || "";
          navigate("chat", s.sessionId);
        },
        "session-link",
      ),
      ib(`Delete conversation: ${s.title || "Untitled task"}`, "trash", () => deleteSession(s)),
      button("···", () => sessionMenu(s), "more"),
    );
  }
  // Drag the edge between the sidebar and the page. The width lives in the backend preferences, so
  // it belongs to the installation rather than to one window, and it survives a restart.
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 520;
  function applySidebarWidth(width) {
    const shell = document.querySelector(".shell");
    if (shell && width) shell.style.setProperty("--sidebar-width", width + "px");
  }
  function sidebarResizer() {
    const handle = el("div", {
      class: "sidebar-resizer",
      role: "separator",
      "aria-orientation": "vertical",
      "aria-label": "Resize sidebar",
      tabindex: "0",
    });
    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      document.querySelector(".shell")?.classList.add("resizing");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const shell = document.querySelector(".shell");
      if (!shell) return;
      const left = shell.getBoundingClientRect().left;
      const width = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, event.clientX - left)));
      shell.style.setProperty("--sidebar-width", width + "px");
    });
    const finish = (event) => {
      if (!dragging) return;
      dragging = false;
      document.querySelector(".shell")?.classList.remove("resizing");
      const shell = document.querySelector(".shell");
      const width = shell ? parseInt(getComputedStyle(shell).getPropertyValue("--sidebar-width"), 10) : 0;
      if (width) rememberPreferenceSoon("sidebarWidth", String(width));
      handle.releasePointerCapture?.(event.pointerId);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    // Arrow keys nudge it, so it works without a precise drag.
    handle.addEventListener("keydown", (event) => {
      const shell = document.querySelector(".shell");
      if (!shell) return;
      const now = parseInt(getComputedStyle(shell).getPropertyValue("--sidebar-width"), 10) || 228;
      const step = event.shiftKey ? 40 : 8;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const width = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, now + (event.key === "ArrowRight" ? step : -step)));
        shell.style.setProperty("--sidebar-width", width + "px");
        rememberPreferenceSoon("sidebarWidth", String(width));
        event.preventDefault();
      }
    });
    return handle;
  }
  // The automation bridge in main.rs already evals into the page: GET /state asks for getState(),
  // POST /action calls performAction(payload). Nothing defined those, so both answered {ok:false} and
  // the only way to press a button was the system pointer — which is somebody else's mouse.
  //
  // This is a loopback-only surface (127.0.0.1, the app's own port): it clicks by selector or by
  // visible text, types, navigates, opens a sidebar group and reads back what the page shows. No
  // pointer, no coordinates, nothing that can land on the wrong window.
  function automationRoot() { return document; }
  function findTarget(spec) {
    if (!spec) return null;
    if (spec.selector) return automationRoot().querySelector(spec.selector);
    const want = String(spec.text || "").trim().toLocaleLowerCase();
    if (!want) return null;
    const candidates = [...automationRoot().querySelectorAll("button, a, [role='button'], .nav-child, .nav-label, label")];
    return candidates.find((node) => (node.textContent || "").trim().toLocaleLowerCase() === want)
      || candidates.find((node) => (node.textContent || "").trim().toLocaleLowerCase().includes(want))
      || null;
  }
  function describe(node) {
    if (!node) return null;
    return {
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || "").trim().slice(0, 80),
      cls: node.className || "",
      connected: node.isConnected,
    };
  }
  window.__quixi_automation__ = {
    getState() {
      const active = automationRoot().querySelector(".sidebar nav button.active, .sidebar nav button[aria-current='page']");
      return {
        ok: true,
        page: state.page,
        title: document.title,
        activeNav: active ? (active.textContent || "").trim() : null,
        groupsOpen: [...automationRoot().querySelectorAll(".nav-group.is-open .nav-label")].map((n) => n.textContent.trim()),
        panel: (automationRoot().querySelector("h1, .settings-content h2, .skill-library h2") || {}).textContent?.trim() || null,
        composer: (automationRoot().querySelector("#prompt") || {}).value ?? null,
        buttons: [...automationRoot().querySelectorAll("button")].slice(0, 40).map((b) => (b.textContent || "").trim()).filter(Boolean),
      };
    },
    performAction(payload) {
      const action = String((payload && (payload.action || payload.type)) || "").toLocaleLowerCase();
      try {
        if (action === "state") return JSON.stringify(this.getState());
        if (action === "click") {
          const target = findTarget(payload);
          if (!target) return JSON.stringify({ ok: false, error: "no target", asked: payload });
          target.click();
          return JSON.stringify({ ok: true, clicked: describe(target) });
        }
        if (action === "type" || action === "fill") {
          const target = findTarget(payload) || automationRoot().querySelector("#prompt");
          if (!target) return JSON.stringify({ ok: false, error: "no input" });
          target.focus();
          target.value = String(payload.text ?? payload.value ?? "");
          target.dispatchEvent(new Event("input", { bubbles: true }));
          return JSON.stringify({ ok: true, typed: describe(target) });
        }
        if (action === "open-group" || action === "toggle-group") {
          const label = String(payload.label || payload.text || "");
          const groups = [...automationRoot().querySelectorAll(".nav-group")];
          const group = groups.find((g) => (g.querySelector(".nav-label")?.textContent || "").trim().toLocaleLowerCase() === label.toLocaleLowerCase());
          if (!group) return JSON.stringify({ ok: false, error: "no group", asked: label });
          group.querySelector(".nav-disclosure")?.click();
          return JSON.stringify({ ok: true, group: label, nowOpen: group.classList.contains("is-open") });
        }
        if (action === "navigate") {
          navigate(String(payload.page || ""));
          return JSON.stringify({ ok: true, page: payload.page });
        }
        // Reading the page back, for tests that need to know what actually rendered rather than what
        // was asked for. Text only, capped, so a huge page cannot flood the bridge.
        if (action === "text") {
          const root = automationRoot();
          const host = root.querySelector("#page-host") || root;
          const text = String(host.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 4000);
          return JSON.stringify({ ok: true, page: state.page, text });
        }
        return JSON.stringify({ ok: false, error: "unknown action", action });
      } catch (error) {
        return JSON.stringify({ ok: false, error: String(error) });
      }
    },
  };
// ---- the table on its own ---------------------------------------------------------------------
// The same fields the wizard asks, without the "are you new" question in front of them: provider,
// key, model, browser, where memory lives and how it is protected. Reachable from the main page for
// people who already know what they want, and from setup as the last step.
function setupPage(host) {
  host.replaceChildren();
  const root = el("div", { class: "first-run" });
  host.append(root);
  root.append(
    el("h1", {}, "Setup"),
    el("p", {
      class: "first-run-lead",
    }, "Everything the wizard asks, in one place. Anything you leave blank stays unset — nothing here is required to start the app."),
  );
  const table = el("div", { class: "first-run-table" });
  root.append(table);
  try {
    quickStep(table);
  } catch (e) {
    table.append(el("p", { class: "first-run-warn" }, `Could not build the table: ${e && e.message ? e.message : e}`));
  }
  // One way back, not two. The table already offers "← Back to onboarding" under Save and start;
  // a second copy in the exit row read as a different action with the same words.
  root.append(
    el("div", { class: "first-run-actions first-run-exit" },
      button("Skip to the app", () => { state.setupDismissed = true; state.page = "new"; render(); }, "reveal"),
    ),
  );
}

function quickStep(into, onBack) {
  const rows = [];
  const providerSel = el("select", { class: "first-run-select" });
  const keyInput = el("input", { type: "password", class: "first-run-key", placeholder: "Paste your API key", spellcheck: false });
  const modelInput = el("input", { type: "text", class: "first-run-key", spellcheck: false, placeholder: "model id" });
  const browserSel = el("select", { class: "first-run-select" });
  const memoryPath = el("input", { type: "text", class: "first-run-key", spellcheck: false, placeholder: "leave blank for Documents/memory-palace" });
  const memoryEnc = el("select", { class: "first-run-select" });
  memoryEnc.append(
    el("option", { value: "none" }, "No encryption — plain files"),
    el("option", { value: "disk" }, "Whole disk (LUKS)"),
    el("option", { value: "archive" }, "age/GPG archive"),
  );
  const status = el("p", { class: "first-run-status" }, "");

  loadProviders().then(() => {
    const list = (state.providers && state.providers.providers) || [];
    providerSel.replaceChildren(
      ...list.map((p) => el("option", { value: p.id }, p.name)),
    );
    // Deliberately no default. This table is reachable on a fresh install, and pre-selecting a
    // provider here made the first thing a new user sees look like a decision they had made.
    const sync = () => {
      const p = list.find((x) => x.id === providerSel.value);
      modelInput.value = (p && p.selectedModel) || "";
      keyInput.placeholder = (p && p.keyPlaceholder) || "Paste your API key";
    };
    providerSel.addEventListener("change", sync);
    sync();
  }).catch(() => {});

  rpc("Memory", "info").then((res) => {
    if (res && res.path) memoryPath.placeholder = res.path;
    if (res && res.encrypted) memoryEnc.value = res.encrypted;
  }).catch(() => {});

  rpc("AppPreferences", "listBrowsers").then((res) => {
    const browsers = (res && res.browsers) || [];
    browserSel.replaceChildren(
      el("option", { value: "system" }, `System default${res && res.stock && res.stock.name ? ` — ${res.stock.name}` : ""}`),
      el("option", { value: "ask" }, "Ask each time"),
      ...browsers.map((b) => el("option", { value: b.id }, b.name)),
    );
  }).catch(() => {});

  const save = async () => {
    status.textContent = "Saving…";
    try {
      const key = keyInput.value.trim();
      const model = modelInput.value.trim();
      if (key || model) {
        const saved = await api("/api/quixi/providers/save", {
          providerId: providerSel.value,
          ...(key ? { apiKey: key } : {}),
          ...(model ? { selectedModel: model } : {}),
          setAsActive: true,
        });
        if (saved.error) throw new Error(saved.error);
      }
      await api("/api/quixi/providers/complete-onboarding", {
        activeProvider: providerSel.value,
        activeModel: model,
      });
      await rpc("AppPreferences", "setPreference", ["externalBrowser", browserSel.value]);
      if (memoryPath.value.trim()) {
        await rpc("AppPreferences", "setPreference", ["memoryPalacePath", memoryPath.value.trim()]);
      }
      await rpc("AppPreferences", "setPreference", ["memoryEncryption", memoryEnc.value]);
      localStorage.setItem("quixi.externalBrowser", browserSel.value);
      await loadProviders();
      toast("Set. Everything else is in Settings.");
      state.page = "new";
      render();
    } catch (err) {
      status.textContent = `Could not save: ${err.message}`;
    }
  };

  for (const field of [keyInput, modelInput, providerSel, browserSel, memoryPath, memoryEnc]) {
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
    });
  }

  const root = into || document.createDocumentFragment();
  root.replaceChildren?.(
    el("h1", {}, "The four things"),
    el("p", { class: "first-run-lead" }, "Provider, key, model, browser. Leave any of them blank and it stays unset — nothing here is required to open the app."),
    el(
      "table",
      { class: "first-run-table" },
      el("tbody", {},
        el("tr", {}, el("th", {}, "Provider"), el("td", {}, providerSel)),
        el("tr", {}, el("th", {}, "API key"), el("td", {}, keyInput)),
        el("tr", {}, el("th", {}, "Model"), el("td", {}, modelInput)),
        el("tr", {}, el("th", {}, "Browser"), el("td", {}, browserSel)),
        el("tr", {}, el("th", {}, "Memory"), el("td", {}, memoryPath)),
        el("tr", {}, el("th", {}, "Encryption"), el("td", {}, memoryEnc)),
      ),
    ),
    el("div", { class: "first-run-actions" },
      button("Save and start", save, "primary"),
      button("← Back to onboarding", () => {
        if (onBack) {
          onBack();
        } else {
          state.setupDismissed = false;
          navigate("onboarding");
        }
      }, "reveal")),
    status,
  );
}

// ---- first run: local or cloud, and nothing assumed -------------------------------------------
// The app used to land on OpenRouter with a model you do not have a key for. That is a dead end
// dressed as a default. The first question is the only one that matters — where do the models run —
// because everything after it differs: a local server needs detecting, a cloud provider needs a key,
// and neither should be guessed on someone's behalf.
function firstRunPage(host) {
  host.replaceChildren();

  // The first question is not "which provider" — it is "have you done this before". A person meeting
  // the app for the first time needs to be walked; a person who already runs three of these wants one
  // table, four fields, and to be left alone. Asking costs one click and saves the wrong experience for
  // whichever of the two is actually sitting there.
  let step = "intro";

  // Nothing is chosen until the person chooses it. A clean install that already has a provider
  // selected is a clean install that looks configured, and then "it just went to Ollama" is the
  // only honest description of what happened.
  const chosen = { mode: null, provider: "", key: "" };

  const card = (title, blurb, body) =>
    el(
      "section",
      { class: "first-run-card" },
      el("h2", {}, title),
      el("p", { class: "first-run-blurb" }, blurb),
      body,
    );

  // --- on this machine -------------------------------------------------------------------------
  const localStatus = el("p", { class: "first-run-status" }, "Not checked yet.");
  const localBtn = button(
    "Use a local model",
    async () => {
      localStatus.textContent = "Looking for a model server on this machine…";
      try {
        await api("/api/quixi/providers/detect-local", {});
        await loadProviders();
        const list = (state.providers && state.providers.providers) || [];
        const found = list.filter((p) => p.category === "local" && p.configured);
        const pick = found[0] || list.find((p) => p.id === "ollama");
        if (!found.length && chosen.modelPath) {
          localStatus.textContent =
            `You picked ${chosen.modelPath}, but no local model server is answering yet. Start one (Ollama, llama.cpp, LM Studio) and it will be detected next time.`;
        }
        if (!pick) throw new Error("No local provider entry found.");
        const r = await api("/api/quixi/providers/complete-onboarding", {
          activeProvider: pick.id,
          activeModel: pick.selectedModel || "",
        });
        if (r.error) throw new Error(r.error);
        await loadProviders();
        toast(found.length ? `Using ${pick.name} on this machine.` : `Set to ${pick.name} — start the service when you are ready.`);
        state.page = "new";
        render();
      } catch (err) {
        localStatus.textContent = `Could not finish: ${err.message}`;
      }
    },
    "reveal",
  );

  // A file dialog that shows "Computer -> /" and hides every drive people actually keep models on is
  // not being awkward on purpose: those are mounts, not removable media. So the drives are listed.
  rpc("LocalModels", "mounts").then((res) => {
    const mounts = (res && res.mounts) || [];
    if (!mounts.length) return;
    const row = document.querySelector(".first-run-mounts");
    if (!row) return;
    for (const m of mounts) {
      row.append(
        button(
          `${m.path}  (${m.fstype})`,
          async () => {
            const pick = await rpc("LocalModels", "pickFolder", [`Look inside ${m.path}`]).catch(() => null);
            const chosenPath = (pick && pick.ok && pick.path) || m.path;
            chosen.modelPath = chosenPath;
            await rpc("AppPreferences", "setPreference", ["localModelPath", chosenPath]);
            localStatus.textContent = "Models at:";
            localStatus.append(el("code", { class: "first-run-cmd" }, chosenPath));
          },
          "reveal",
        ),
      );
    }
  }).catch(() => {});

  // --- over the internet ------------------------------------------------------------------------
  const cloudBody = el("div", { class: "first-run-cloud", hidden: true });
  const providerSelect = el("select", { class: "first-run-select" });
  const keyInput = el("input", {
    type: "password",
    class: "first-run-key",
    placeholder: "Paste your API key",
    spellcheck: false,
    autocapitalize: "off",
  });
  const cloudStatus = el("p", { class: "first-run-status" }, "");

  // A dropdown with nothing in it is not a dropdown. The catalog normally arrives from the engine
  // before this screen is reached, but on a fresh install it can still be in flight — and an empty
  // <select> looks exactly like a control that does not open. These two entries are always present
  // so there is something to pick while the full list is still loading.
  const FALLBACK_CLOUD = [
    { id: "ollama-cloud", name: "Ollama Cloud", keyPlaceholder: "Paste your API key", baseUrl: "https://ollama.com/v1", docsUrl: "https://ollama.com/settings/keys" },
    { id: "custom", name: "Custom endpoint (OpenAI-compatible)", keyPlaceholder: "Paste your API key", baseUrl: "", docsUrl: "" },
  ];

  function fillCloud() {
    const list = (state.providers && state.providers.providers) || [];
    const fromCatalog = list.filter((p) => p.category !== "local");
    // Alphabetical, because a list somebody has to scan should be in the order they scan it in. The
    // catalog's own order is a priority ranking, which is useful in Settings and useless in a
    // dropdown where the person is looking for a name they already know.
    const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
    const cloud = fromCatalog.length ? [...fromCatalog].sort(byName) : FALLBACK_CLOUD;
    // A select that silently shows the first provider reads as "already chosen". The placeholder
    // makes it a question with an answer missing, which is what it is.
    const placeholder = el("option", { value: "" }, "Choose a provider…");
    providerSelect.replaceChildren(placeholder, ...cloud.map((p) => {
      const o = el("option", { value: p.id }, p.name);
      if (p.id === chosen.provider) o.selected = true;
      return o;
    }));
    if (!chosen.provider) providerSelect.value = "";
    // No `|| cloud[0]` any more: that fallback is what printed Ollama Cloud under an untouched
    // dropdown. With nothing selected there is no active provider and nothing to describe.
    const active = cloud.find((p) => p.id === providerSelect.value);
    keyInput.placeholder = active ? active.keyPlaceholder || "Paste your API key" : "Paste your API key";
    // A key page that is printed as text cannot be clicked, and asking somebody to copy a URL out
    // of a paragraph is a small tax on every single setup. Both the provider it is talking about and
    // the link to its key page are here, and the link opens in the browser the app already uses.
    cloudStatus.replaceChildren();
    if (active) {
      cloudStatus.append(el("span", {}, `${active.name}${active.baseUrl ? " · " + active.baseUrl : ""}`));
      if (active.docsUrl) {
        cloudStatus.append(
          el("span", {}, " · "),
          el(
            "a",
            {
              href: "#",
              onclick: (event) => { event.preventDefault(); openExternal(active.docsUrl); },
            },
            "Get a key ↗",
          ),
        );
      }
    }
  }
  providerSelect.addEventListener("change", () => {
    chosen.provider = providerSelect.value;
    fillCloud();
  });

  const cloudBtn = button(
    "Connect and start",
    async () => {
      const key = keyInput.value.trim();
      if (!providerSelect.value) { cloudStatus.textContent = "Choose a provider first."; providerSelect.focus(); return; }
      if (!key) { cloudStatus.textContent = "That provider needs a key before it can answer."; return; }
      cloudStatus.textContent = "Saving and testing…";
      try {
        const list = (state.providers && state.providers.providers) || [];
        const p = list.find((x) => x.id === providerSelect.value);
        const saved = await api("/api/quixi/providers/save", {
          providerId: providerSelect.value,
          apiKey: key,
          selectedModel: (p && p.selectedModel) || "",
          setAsActive: true,
        });
        if (saved.error) throw new Error(saved.error);
        const done = await api("/api/quixi/providers/complete-onboarding", {
          activeProvider: providerSelect.value,
          activeModel: (p && p.selectedModel) || "",
        });
        if (done.error) throw new Error(done.error);
        await loadProviders();
        step = "memory";
        paint();
      } catch (err) {
        cloudStatus.textContent = `Could not connect: ${err.message}`;
      }
    },
    "",
  );

  // Enter anywhere in the key field connects. Nobody should have to hunt for a button with the
  // cursor when the key is the last thing they typed.
  for (const field of [keyInput, providerSelect]) {
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); cloudBtn.click(); }
    });
  }

  cloudBody.append(
    el("h2", { class: "first-run-subhead" }, "Choose a provider"),
    el(
      "p",
      { class: "first-run-hint" },
      "Ollama Cloud is one of the cheapest ways in — a small monthly allowance rather than per-token billing, which matters when the budget is fixed rather than flexible — and it is what this edition is built and tested against, so it is the one least likely to surprise you. A local model on this machine costs nothing after the download, if the machine can hold one. Any OpenAI-compatible endpoint works as well; nothing here locks you to a single provider.",
    ),
    el("label", { class: "first-run-label" }, "Provider", providerSelect),
    el("p", { class: "first-run-hint" }, "The key stays in this app's own store, not in the memory folder."),
    el("label", { class: "first-run-label" }, "API key", keyInput),
    cloudBtn,
    cloudStatus,
  );

  const cloudBtnReveal = button(
    "Use a cloud provider",
    () => {
      chosen.mode = "cloud";
      cloudBody.hidden = false;
      fillCloud();
      // Fill again once the catalog lands, so the fallback list is replaced by the real one
      // without the dropdown ever being empty in between.
      loadProviders().then(fillCloud).catch(() => {});
      keyInput.focus();
    },
    "reveal",
  );

  const root = el("div", { class: "first-run" });
  host.append(root);


  // Before the first question: who made this, what it is, and the one fact that should never be a
  // surprise — this is assistive software.
  function editionWelcome() {
    let open = false;
    const about = el("div", { class: "first-run-about", hidden: true });
    about.append(
      el("h2", {}, "What Nora is"),
      el(
        "p",
        {},
        "An aide, not a chatbot. A special assistant that runs on your machine, for you, one user — her memory is a folder you own, her voice is synthesized locally, and she answers to you rather than to a policy. The aim is a thing that keeps context the way a person does: remembers what mattered, forgets on purpose, and says when it does not know.",
      ),
      el("h2", {}, "What we are aiming for"),
      el(
        "p",
        {},
        "Software that treats the person in front of it as the authority on their own life. No lectures, no moralising about your words, no gatekeeping of your own machine. It is meant to be edited: the persona is a file, the memory is a folder, and neither is sacred.",
      ),
      el("h2", {}, "Disability is the brief, not the disclaimer"),
      el(
        "p",
        {},
        "This is assistive software, built by a person with disabilities. The tool was made because the standard ones assume a user whose words arrive whole and whose memory holds the thread. Nora exists for the times it does not — to remember what was said, to keep the record straight when memory is not, and to do it without making anyone feel managed. Being disabled carries its own trauma, whether or not there is a disorder behind it, and that is why the care here is trauma-informed rather than condition-specific. Under the ADA that is the point of an effective communication aid: it has to work for the person using it, in the form that person needs.",
      ),
      el(
        "p",
        { class: "muted" },
        "That is all this screen will say about it. If you want to know more, ask Nora later — she will tell you what she is allowed to, and no more than that.",
      ),
      el("h2", {}, "But I'm not disabled. Why would I want this?"),
      el(
        "p",
        {},
        "You might not be, and it is none of my business either way. Whether you are disabled, and how, is yours to tell or to keep — under the ADA and HIPAA you are not obliged to hand that over to a stranger as the price of using a piece of software. Nothing here asks, and nothing here checks.",
      ),
      el(
        "p",
        {},
        "What this is, underneath the friendliness, is an accessibility tool. Assistive software is built to a different standard: it assumes the person in front of it may be working harder than they look, so it keeps the record, it does not lose the thread, and it does not make anyone explain themselves twice. That is why it can go places an ordinary assistant cannot — it is the thing you reach for when the ordinary one assumes a user whose words arrive whole.",
      ),
      el(
        "p",
        { class: "muted" },
        "If you have no use for that, you will still get a plain, private assistant that runs on your own machine. If you do, you will not have to say so first.",
      ),
    );

    // Written for somebody who has never used a tool like this and may be doing it while tired,
    // in pain, or under a deadline that nobody else can see. Nothing is assumed, nothing is
    // simplified into uselessness, and no step is timed. This is the edition for that person.
    let howOpen = false;
    const how = el("div", { class: "first-run-about", hidden: true });
    how.append(
      el("h2", {}, "A model is the part that writes"),
      el(
        "p",
        {},
        "It is the thing that turns what you type into what you get back. It is either a file on this machine — a few gigabytes you download once — or a service somewhere else that you reach with a key. Nothing else in this app does anything without one, which is why it is the first question.",
      ),
      el("h2", {}, "A provider is where that model lives"),
      el(
        "p",
        {},
        "\"On this machine\" means the file is yours and it runs on your hardware: no account, no bill, nothing leaves the computer. \"Over the internet\" means somebody else runs it and you reach it with a key, which works on a laptop far too small for the model itself.",
      ),
      el("h2", {}, "An API key is a password that pays for it"),
      el(
        "p",
        {},
        "It is not your account password, and it is not your email password. It is a long string the provider gives you, and it is what the service counts when you use it. It goes into this app's own store, not into the memory folder, and you can replace or remove it at any time.",
      ),
      el("h2", {}, "The memory folder is a folder"),
      el(
        "p",
        {},
        "Markdown files in a directory you choose. You can open them in any text editor, copy them, back them up, put them in git, or delete them. Nothing in it needs this app to be readable — that is the point of it being a folder.",
      ),
      el("h2", {}, "There is no clock on any of this"),
      el(
        "p",
        { class: "muted" },
        "Every step can be skipped, every answer can be changed later in Settings, and nothing here expires while you think. If you would rather read all of it as one table instead of walking through it, \"Just give me the table\" does that.",
      ),
    );

    const aboutBtn = button(
      "About Nora",
      () => {
        open = !open;
        about.hidden = !open;
        aboutBtn.textContent = open ? "Hide that" : "About Nora";
      },
      "quiet",
    );
    const howBtn = button(
      "New to tools like this?",
      () => {
        howOpen = !howOpen;
        how.hidden = !howOpen;
        howBtn.textContent = howOpen ? "Hide that" : "New to tools like this?";
      },
      "quiet",
    );

    root.replaceChildren(
      el("p", { class: "first-run-kicker" }, "volkdude85 edition"),
      // Onboarding is met by everybody, so it gets the plain greeting no matter which theme is
      // selected. "Sup bitches" belongs to his own register, and a stranger's first screen is not
      // the place to try it out on them.
      el("h1", {}, "Sup"),
      el(
        "p",
        { class: "first-run-lead" },
        "We do things a little differently here — starting with this. You get asked before you get configured, and the two questions that follow decide what the app is: where the models run, and where your memory lives.",
      ),
      el(
        "div",
        { class: "first-run-actions" },
        button("Let's set it up", () => { step = "choose"; paint(); }, "primary"),
        aboutBtn,
        howBtn,
      ),
      el("div", { class: "first-run-actions first-run-exit" },
        button("Skip setup — straight to the app", () => {
          state.setupDismissed = true;
          state.page = "new";
          render();
        }, "quiet"),
        button("Just give me the table", () => {
          state.setupDismissed = true;
          navigate("setup");
        }, "quiet"),
      ),
      about,
      how,
      el(
        "p",
        { class: "first-run-foot" },
        "Built as assistive software. The memory is a folder of markdown you own, the models run where you say, and nothing here is locked to an account.",
      ),
    );
  }

  function welcomeStep() {
    root.replaceChildren(
      el("h1", {}, "Are you new to QuixiDesk?"),
      el(
        "p",
        { class: "first-run-lead" },
        "Yes walks you through it in two questions. No gives you one table with the four things that matter and gets out of the way — everything else lives in Settings, and you can come back here by deleting your app data.",
      ),
      el(
        "div",
        { class: "first-run-grid" },
        el(
          "section",
          { class: "first-run-card" },
          el("h2", {}, "Yes — this is my first one"),
          el("p", { class: "first-run-blurb" }, "Where the models run, then how they get there. Nothing assumed, nothing pre-filled that you did not ask for."),
          el("div", { class: "first-run-actions" }, button("Walk me through it", () => { step = "choose"; paint(); }, "")),
        ),
        el(
          "section",
          { class: "first-run-card" },
          el("h2", {}, "No — I know what I'm doing"),
          el("p", { class: "first-run-blurb" }, "One table: provider, key, model, browser. Skip anything and fix it later in Settings."),
          el("div", { class: "first-run-actions" }, button("Give me the table", () => { step = "quick"; paint(); }, "quiet")),
        ),
      ),
      el("p", { class: "first-run-foot" }, "Neither answer is a commitment. Both end in the same working app; the difference is how much you have to read to get there."),
    );
  }



  // What a memory palace is, where it goes, and what protects it. Asked here rather than buried in
  // Settings because it is the one decision that changes what the app is: a folder of markdown that
  // grows forever, or nothing remembered between sessions.
  function memoryStep(onDone) {
    const info = el("p", { class: "first-run-status" }, "Reading the palace…");
    const pathInput = el("input", { type: "text", class: "first-run-key", spellcheck: false });
    const modeSel = el("select", { class: "first-run-select" });
    const encSel = el("select", { class: "first-run-select" });
    modeSel.append(
      el("option", { value: "sealed" }, "Sealed archive — append-only: the app never deletes. You can still delete the files yourself in any file manager"),
      el("option", { value: "folder" }, "Ordinary folder — you can delete anything"),
    );
    // Three real choices and an honest fourth. Each says what it protects and what it costs, and
    // shows the command, because this app does not do the encrypting — pretending otherwise would be
    // worse than the warning.
    const ENC = {
      luks: {
        label: "LUKS — whole disk (recommended)",
        what: "Protects everything on the disk, including files you have not created yet. Decided before the system is installed, or by reinstalling — the strongest protection and the most disruptive to adopt later.",
        how: "wiki.archlinux.org/title/Dm-crypt/Encrypting_an_entire_system",
      },
      age: {
        label: "age — one key file, encrypted palace",
        what: "Encrypts the palace into a single file you can move or back up. One key file, modern defaults, no GPG ceremony. Unlocks with a passphrase or a key you keep somewhere else.",
        how: "tar czf - palace/ | age -p -o palace.tar.gz.age",
      },
      gpg: {
        label: "GPG — a key you already have",
        what: "Encrypts the palace to a key that already exists — yours, or one on a hardware token. The most compatible option and the fiddliest; unattended decryption means the secret is on the box.",
        how: "tar czf - palace/ | gpg -e -r you@example.com > palace.tar.gz.gpg",
      },
      none: {
        label: "Nothing — plain files on this disk",
        what: "",
        how: "",
      },
    };
    encSel.append(...Object.entries(ENC).map(([v, o]) => el("option", { value: v }, o.label)));

    const encNote = el("div", { class: "first-run-enc" });
    const paintEnc = () => {
      const chosen = ENC[encSel.value] || ENC.none;
      encNote.replaceChildren(
        chosen.what ? el("p", { class: "muted" }, chosen.what) : null,
        chosen.how ? el("code", { class: "first-run-cmd" }, chosen.how) : null,
        encSel.value === "none"
          ? el(
              "p",
              { class: "first-run-warn" },
              "Without encryption, anyone who gets this disk — or any account on this machine — can read every conversation in it. Reasonable on a desktop that stays in a locked room; a bad trade on a laptop.",
            )
          : null,
      );
    };
    encSel.addEventListener("change", paintEnc);
    const warn = el("span", {}, "");

    rpc("Memory", "info").then((res) => {
      const r = res || {};
      pathInput.value = r.path || "";
      info.textContent = r.drawers
        ? `${r.drawers} drawers in ${r.wings} wings, ${(Number(r.bytes || 0) / 1024).toFixed(0)} KB at ${r.path}.`
        : `Nothing yet. It would start at ${r.path}.`;
      if (r.encrypted && ENC[r.encrypted]) encSel.value = r.encrypted;
      paintEnc();
    }).catch(() => { info.textContent = "Could not read the palace."; });

    const save = async () => {
      const path = pathInput.value.trim();
      await rpc("AppPreferences", "setPreference", ["memoryPalacePath", path]);
      await rpc("AppPreferences", "setPreference", ["memoryMode", modeSel.value]);
      await rpc("AppPreferences", "setPreference", ["memoryEncryption", encSel.value]);
      onDone();
    };
    for (const f of [pathInput, modeSel, encSel]) {
      f.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } });
    }

    root.replaceChildren(
      el("h1", {}, "Where should your memory live?"),
      el(
        "p",
        { class: "first-run-lead" },
        "The palace is a folder of markdown: wings, rooms, drawers. No database, no format of its own — you can read it, grep it, put it in git, back it up like any other folder. The app remembers by writing files here and reading them back on later turns.",
      ),
      el(
        "div",
        { class: "first-run-explain" },
        el("h2", {}, "Where it came from"),
        el(
          "p",
          {},
          "The shape is not invented here. It follows MemPalace — wings, rooms, drawers, ranked search over plain files — because the idea was already right and already public. This edition implements it rather than inventing a second one.",
        ),
        el("h2", {}, "Why this is not how Quixi Core does it"),
        el(
          "p",
          {},
          "Core keeps one file, MEMORY.md, and pastes the whole thing into the prompt on every turn. That works beautifully for a few pages and then stops: once it is full, everything you know competes with everything else for the same budget, and something has to be deleted before something else can be added. The file stops being a record and becomes a summary of a record.",
        ),
        el(
          "p",
          {},
          "The palace is a ranked search instead of a paste. Context holds only what this conversation turned out to need; the rest stays on disk, addressable, unbounded, and yours to edit with any editor you already own.",
        ),
        el("h2", {}, "What it does not do, so you are not surprised"),
        el(
          "p",
          {},
          "No automatic capture — nothing writes itself; a fact is stored because something stored it. No summarisation — drawers are verbatim. No embedding index in this implementation; ranking is over the text. And no sync: it is a local folder, so putting it on two machines is yours to solve, not something this pretends to do.",
        ),
        el(
          "p",
          { class: "first-run-foot" },
          "In Core, none of this exists and MEMORY.md stays exactly as upstream wrote it. That is a deliberate difference between the two editions, not an oversight in either.",
        ),
      ),
      el(
        "table",
        { class: "first-run-table" },
        el("tbody", {},
          el("tr", {}, el("th", {}, "Folder"), el("td", {}, pathInput)),
          el("tr", {}, el("th", {}, "Keeping"), el("td", {}, modeSel)),
          el("tr", {}, el("th", {}, "Encryption"), el("td", {}, encSel)),
        ),
      ),
      info,
      encNote,
      warn,
      el("div", { class: "first-run-actions" },
        button("Save and finish", save, "primary"),
        button("Leave the default", async () => { await save(); }, "reveal")),
    );
  }

  // A way out of setup from any step, because a first-run screen that cannot be left is a modal in
  // disguise. It goes to the app, and the table stays one button away from there.
  function wizardExitBar() {
    return el("div", { class: "first-run-actions first-run-exit" },
      button("← Back to the start", () => {
        state.setupDismissed = false;
        navigate("onboarding");
      }, "quiet"),
      button("Just give me the table", () => {
        state.setupDismissed = true;
        navigate("setup");
      }, "quiet"),
    );
  }

  // Every step paints into the same root as a side effect, then gets the exit bar appended — so the
  // way out is on every screen, including the ones that replace the root wholesale.
  function paint() {
    const exitBar = () => {
      if (step !== "intro") root.append(wizardExitBar());
    };
    if (step === "intro") return editionWelcome();
    if (step === "welcome") { welcomeStep(); exitBar(); return; }
    if (step === "quick") {
      quickStep(root, () => { step = "welcome"; paint(); });
      exitBar();
      return;
    }
    if (step === "memory") {
      memoryStep(() => {
        toast("Set. The palace is where you put it.");
        state.page = "new";
        render();
      });
      exitBar();
      return;
    }
    root.replaceChildren(
      el("h1", {}, "Where should the models run?"),
      el(
        "p",
        { class: "first-run-lead" },
        "This edition does not assume. Both answers work; they need different things from you. You can change this later in Settings.",
      ),
      el(
        "div",
        { class: "first-run-grid" },
        card(
          "On this machine",
          "Nothing leaves the computer and no account is needed. Requires a local model server — Ollama, LM Studio, llama.cpp or anything OpenAI-compatible.",
          el(
            "div",
            { class: "first-run-actions" },
            localBtn,
            button(
              "Choose my model folder…",
              async () => {
                const res = await rpc("LocalModels", "pickFolder", ["Where are your local models?"]).catch(() => null);
                if (res && res.ok && res.path) {
                  chosen.modelPath = res.path;
                  await rpc("AppPreferences", "setPreference", ["localModelPath", res.path]);
                  localStatus.textContent = `Models at ${res.path} — ${res.path}`.replace(/ — .*$/, "");
                  localStatus.append(el("code", { class: "first-run-cmd" }, res.path));
                } else {
                  localStatus.textContent = "No folder chosen. You can also set it later in Settings.";
                }
              },
              "quiet",
            ),
            button(
              "Choose a model file…",
              async () => {
                const res = await rpc("LocalModels", "pickFile", ["Choose a model file (.gguf)"]).catch(() => null);
                if (res && res.ok && res.path) {
                  chosen.modelPath = res.path;
                  await rpc("AppPreferences", "setPreference", ["localModelPath", res.path]);
                  localStatus.textContent = "Model file:";
                  localStatus.append(el("code", { class: "first-run-cmd" }, res.path));
                } else {
                  localStatus.textContent = "No file chosen. You can also set it later in Settings.";
                }
              },
              "quiet",
            ),
            localStatus,
            el(
              "div",
              { class: "first-run-mounts" },
              el("p", { class: "muted" }, "Or pick a drive on this machine:"),
            ),
            el(
              "div",
              { class: "first-run-getmodel" },
              el("p", { class: "muted" }, "No model on disk yet? Two routes, both fine:"),
              el(
                "div",
                { class: "first-run-actions" },
                button(
                  "Ollama — pull a ready-made model",
                  () => openExternal("https://ollama.com/library"),
                  "quiet",
                ),
                button(
                  "Hugging Face — search GGUF builds",
                  () => openExternal("https://huggingface.co/models?library=gguf"),
                  "quiet",
                ),
              ),
              el(
                "p",
                { class: "muted" },
                "Ollama gives you a model that runs with one command and no thinking. Hugging Face gives you the file itself, which is what llama.cpp, LM Studio and this app's own tooling read directly. Both land in a folder the picker above can see.",
              ),
            ),
          ),
        ),
        card(
          "Over the internet",
          "A provider answers with your key: Ollama Cloud, OpenRouter, or any compatible endpoint. Nothing to install, and the model is not running on your hardware.",
          el("div", { class: "first-run-actions" }, cloudBtnReveal, cloudBody),
        ),
      ),
      el(
        "p",
        { class: "first-run-foot" },
        "If you are not sure: choose local. It answers without an account, and a cloud provider can be added at any time from the provider list.",
      ),
    );
    exitBar();
  }

  paint();
}

  // One answer to "is this install still in first run", used by the page router and by anything that
  // should not exist yet. The Choose model control is the one that matters: offering a model picker
  // on a machine with no provider configured is an invitation to a dead end.
  function needsOnboarding() {
    const hasHistory = (state.sessions || []).length > 0;
    const setupDone = !!(state.providers && state.providers.onboardingCompleted === true);
    return !hasHistory && !setupDone && !state.setupDismissed;
  }

  function renderPage() {
    const host = document.getElementById("page-host");
    if (!host) return;
    const handlers = {
      new: chatPage,
      onboarding: firstRunPage,
      setup: setupPage,
      chat: chatPage,
      search: workspaceUI.searchPage,
      projects: workspaceUI.projectsPage,
      project: workspaceUI.projectPage,
      artifacts: workspaceUI.artifactsPage,
      schedules: schedulesPage,
      daemons: daemonsPage,
      tasks: tasksPage,
      tools: capabilityUI.renderTools,
      settings: settingsPage,
      persona: personaPage,
    };
    // First run, unanswered: ask where the models run before showing a chat that cannot answer. The
    // gate has a door in it — skipping holds for the session, because setup you cannot leave is a trap
    // rather than a setup.
    // The flag is not the whole test. A preferences file can be reset, migrated, or shipped empty
    // into an install that already has weeks of conversation in it, and re-asking somebody who has
    // been using the app for a month is the fastest way to look broken. If there is history, this
    // is not a first run, whatever the flag says.
    // Only an explicit "yes, this install has been through setup" skips it. Anything else — a
    // missing field, a reset preferences file, a migration that dropped the key — is treated as a
    // first run, because the failure that matters is somebody landing in a chat that cannot answer
    // with no way back to the question. Back navigation lands here too: the last history entry is
    // "new instance", so with no history that is the onboarding screen.
    const unanswered = needsOnboarding();
    if (unanswered && (state.page === "new" || state.page === "chat")) {
      firstRunPage(host);
    } else {
      handlers[state.page]?.(host);
    }
    if (state.browser) renderBrowser(host);
  }
  let conversationFind = null;
  function closeConversationFind() {
    document.getElementById("conversation-find")?.remove();
    for (const mark of document.querySelectorAll("#conversation mark[data-find]")) mark.replaceWith(document.createTextNode(mark.textContent));
    conversationFind = null;
    document.getElementById("prompt")?.focus();
  }
  function refreshConversationFind(scroll = true) {
    if (!conversationFind) return;
    const target = document.getElementById("conversation");
    if (!target || conversationFind.session !== state.id) { closeConversationFind(); return; }
    for (const mark of target.querySelectorAll("mark[data-find]")) mark.replaceWith(document.createTextNode(mark.textContent));
    target.normalize();
    const query = conversationFind.input.value.toLocaleLowerCase();
    const matches = [];
    if (query) {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.parentElement.closest("button,textarea,input,script,style")) continue;
        const text = node.textContent; const lower = text.toLocaleLowerCase();
        let at = 0, pos = lower.indexOf(query); if (pos < 0) continue;
        const fragment = document.createDocumentFragment();
        while (pos >= 0 && matches.length < 2000) {
          fragment.append(document.createTextNode(text.slice(at, pos)));
          const mark = el("mark", {"data-find":"true"}, text.slice(pos, pos + query.length));
          fragment.append(mark); matches.push(mark); at = pos + query.length; pos = lower.indexOf(query, at);
        }
        fragment.append(document.createTextNode(text.slice(at))); node.replaceWith(fragment);
      }
    }
    conversationFind.matches = matches;
    conversationFind.index = matches.length ? ((conversationFind.index % matches.length) + matches.length) % matches.length : 0;
    conversationFind.status.textContent = matches.length ? `${conversationFind.index + 1} of ${matches.length}${matches.length === 2000 ? "+" : ""}` : "No matches";
    const current = matches[conversationFind.index];
    if (current) { current.classList.add("find-current"); if (scroll) { for (let p=current.parentElement; p && p!==target; p=p.parentElement) if (p.tagName==="DETAILS") p.open=true; current.scrollIntoView?.({block:"center"}); } }
  }
  function stepConversationFind(delta) { if (conversationFind) { conversationFind.index += delta; refreshConversationFind(); } }
  function openConversationFind() {
    if (!session()) return;
    if (conversationFind && document.getElementById("conversation-find")) { conversationFind.input.focus(); conversationFind.input.select(); return; }
    const input = el("input", {type:"search",placeholder:"Find in this conversation", "aria-label":"Find in conversation"});
    const status = el("span", {role:"status", "aria-live":"polite"}, "No matches");
    const bar = el("div", {id:"conversation-find",class:"conversation-find",role:"search"},input,status,
      button("Previous match",()=>stepConversationFind(-1),"quiet"),button("Next match",()=>stepConversationFind(1),"quiet"),button("Close find",closeConversationFind,"quiet","close"));
    conversationFind={input,status,index:0,matches:[],session:state.id};
    input.addEventListener("input",()=>{conversationFind.index=0;refreshConversationFind();});
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();stepConversationFind(e.shiftKey?-1:1);}else if(e.key==="Escape"){e.preventDefault();closeConversationFind();}});
    document.getElementById("conversation").before(bar);input.focus();
  }
  function toolResultView(content) {
    let media;try{media=JSON.parse(content);}catch{}
    if(media?._quixi_tool_media) {
      let label=media.text;try{label=JSON.parse(label).content?.map(p=>p.text||"").filter(Boolean).join("\n")||label;}catch{}
      return el("div",{},el("p",{},label),...(media.images||[]).map(p=>el("img",{src:p.image_url.url,alt:"Screenshot returned by tool",class:"tool-screenshot",loading:"lazy"})));
    }
    return el("pre",{},typeof content === "string" ? content : JSON.stringify(content,null,2));
  }
  function chatPage(host) {
    const s = session();
    const main = el("section", { class: "chat-main" + (s ? "" : " is-new") });

    // The text column is capped at 740px so long lines stay readable, and that cap was fixed — the
    // window could be 4000px wide and the chat stayed 740. This puts a handle on the right edge of
    // the column itself: grab the edge of the text and pull. --chat-width drives both the padding on
    // .conversation and this handle's position, so they can never disagree.
    const chatResizer = el("div", {
      class: "chat-resizer",
      title: "Drag to change the reading width",
      "aria-hidden": "true",
    });
    const applyChatWidth = (px) => {
      const w = Math.max(420, Math.min(window.innerWidth - 200, Math.round(px)));
      document.documentElement.style.setProperty("--chat-width", `${w}px`);
      localStorage.setItem("quixi.chatWidth", String(w));
    };
    const savedWidth = Number(localStorage.getItem("quixi.chatWidth") || 0);
    if (savedWidth) document.documentElement.style.setProperty("--chat-width", `${savedWidth}px`);
    chatResizer.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      chatResizer.setPointerCapture(event.pointerId);
      const rect = main.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      const move = (ev) => {
        // Symmetric: the column is centred, so its width is twice the nearer edge distance.
        applyChatWidth(Math.abs(ev.clientX - centre) * 2);
      };
      const up = () => {
        chatResizer.removeEventListener("pointermove", move);
        chatResizer.removeEventListener("pointerup", up);
      };
      chatResizer.addEventListener("pointermove", move);
      chatResizer.addEventListener("pointerup", up);
    });
    main.append(chatResizer);
    if (s)
      main.append(
        el(
          "div",
          { class: "session-heading" },
          el("h2", { class: "visually-hidden" }, s.title || "Untitled task"),
          el(
            "span",
            { class: "context-label" },
            icon("folder", 14),
            currentFolder().split(/[\\/]/).filter(Boolean).pop() || "No folder selected",
          ),
          project() ? button(project().name, () => navigate("project", project().id), "quiet project-chip", "projects") : null,
          s.forkedFrom ? button("Original conversation",()=>navigate("chat",s.forkedFrom.sessionId),"quiet") : null,
          button("Find in conversation", () => openConversationFind(), "quiet", "search"),
          button("Files & context", () => contextDrawer(), "quiet"),
          ib("Delete conversation", "trash", () => deleteSession(s)),
          ib("Task actions", "more", () => sessionMenu(s)),
        ),
      );
    const conversation = el("div", {
      class: "conversation",
      id: "conversation",
      "aria-label": "Conversation",
      "aria-live": "off",
    });
    if (!s)
      conversation.append(
        el(
          "div",
          { class: "welcome" },
          el(
            "div",
            { class: "eyebrow" },
            project() ? project().name : "NEW INSTANCE",
          ),
          // Two voices, and the loud one is opt-in. A brand-new install should read like the app,
          // not like somebody else's running joke; pick the volkdude85 theme and you get the
          // version with the teeth in it.
          el(
            "h1",
            { class: "hero-heading" },
            // One greeting, two registers. The plain one is what a stranger meets; his own theme is
            // allowed to say the thing it has always said, because he chose it and it is his name on
            // the build.
            volkdudeVoice() ? "Sup bitches" : "Sup",
          ),
          el(
            "p",
            {},
            volkdudeVoice()
              ? "What are we building, fixing, or destroying today?"
              : "Ask for something, or start from one of these.",
          ),
          // ADDED, not substituted: with no conversation history this is the first thing anybody
          // meets, so Nora introduces herself the way a person would — name, the question that
          // matters (what to call them), and what this thing is. It disappears the moment there is a
          // conversation to show instead.
          state.sessions.length === 0
            ? el(
                "div",
                { class: "nora-intro" },
                el("p", { class: "nora-intro-hello" }, volkdudeVoice() ? "Sup, bitches — I'm Nora." : "Hi — I'm Nora."),
                el("p", {}, "You're new here, so: what do I call you?"),
                el(
                  "p",
                  { class: "muted" },
                  "I'm an aide that runs on this machine — your machine — for you, one user. I keep a memory folder you own, so the next session does not start from nothing. Nothing here is locked to an account, and every part of it can be changed or deleted later.",
                ),
              )
            : null,
          el(
            "div",
            { class: "suggestions" },
            ...[
              [
                "Plan my next project",
                "Help me make a practical plan for my next project. Start by asking about the outcome and constraints.",
                "projects",
                "Turn an idea into next steps",
              ],
              [
                "Understand a codebase",
                "Help me understand this workspace. Start with a read-only overview of the project structure.",
                "code",
                "Get oriented in your workspace",
              ],
              [
                "Make a useful artifact",
                "Help me create a private local HTML artifact. Ask what it should do before building it.",
                "artifacts",
                "Build something you can use",
              ],
            ].map(([label, prompt, ic, description]) =>
              button(
                [
                  icon(ic, 17),
                  el(
                    "span",
                    {},
                    el("strong", {}, label),
                    el("small", {}, description),
                  ),
                ],
                () => {
                  document.getElementById("prompt").value = prompt;
                  saveDraft();
                  document.getElementById("prompt").focus();
                },
              ),
            ),
          ),
        ),
      );
    main.append(conversation, composer());
    if (!s) main.append(conversation.querySelector(".suggestions"));
    host.replaceChildren(main);
    renderChips();
    if (s) renderTranscript();
  }
  // How many MCP servers can actually serve context.
  //
  // The picker behind this button browses `resources` and `prompts`, and it filters built-in
  // adapters out entirely (`list.filter(s => !s.builtin)`). That is correct — the built-ins expose
  // neither method; measured against all six on this box, `resources/list` and `prompts/list` come
  // back -32601 "Method not found". Which meant the button opened a dialog whose only possible
  // content was "Configure an MCP server in Tools & skills to add external context": a live control
  // with nothing behind it, sitting in the composer next to controls that work.
  //
  // It appears when it has somewhere to browse, and stays out of the row until then. -1 is
  // "unknown, ask the backend"; anything else is a cached count, cleared when the server list is
  // edited.
  let mcpContextServers = -1;
  function mcpContextServerCount() {
    if (mcpContextServers >= 0) return Promise.resolve(mcpContextServers);
    return rpc("LocalAgentModeSessions", "getLocalMcpServers")
      .then((list) => {
        mcpContextServers = Array.isArray(list) ? list.filter((s) => !s.builtin).length : 0;
        return mcpContextServers;
      })
      .catch(() => {
        mcpContextServers = 0;
        return 0;
      });
  }
  function mcpContextButton() {
    const node = ib("Add MCP context", "link", () => mcpContextPicker());
    node.style.display = "none";
    mcpContextServerCount().then((n) => {
      if (n > 0) node.style.display = "";
    });
    return node;
  }
  function composer() {
    const s = session();
    // Navigation belongs to this composer, never another conversation's draft.
    let history = null, historyIndex = 0, historyDraft = "";
    const resetHistory = () => { history = null; };
    const recallPrompt = (e) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key) || e.isComposing ||
          e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || ta.disabled ||
          ta.selectionStart !== ta.selectionEnd) return false;
      const up = e.key === "ArrowUp";
      if (up ? ta.value.slice(0, ta.selectionStart).includes("\n")
             : ta.value.slice(ta.selectionEnd).includes("\n")) return false;
      if (!history) {
        if (!up) return false;
        const current = session();
        const messages = current?._kind === "code"
          ? state.transcripts.get(current.sessionId) || []
          : current?.bufferedMessages || [];
        history = messages.filter(m => m.type === "user").map(m =>
          textBlocks(m).filter(b => b.type === "text" && !b.attachment)
            .map(b => b.text || "").join("\n")).filter(text => text.trim());
        history.push(...(state.pendingMessages.get(current?.sessionId) || [])
          .map(m => m.text || "").filter(text => text.trim()));
        historyIndex = history.length;
        historyDraft = ta.value;
      }
      if (!history.length) { resetHistory(); return false; }
      e.preventDefault();
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (up ? -1 : 1)));
      ta.value = historyIndex === history.length ? historyDraft : history[historyIndex];
      const caret = up ? 0 : ta.value.length;
      ta.setSelectionRange(caret, caret);
      saveDraft();
      return true;
    };
    const ta = el("textarea", {
      id: "prompt",
      "data-draft-key": draftKey(),
      disabled: pendingSubmissions.has(draftKey()),
      placeholder: running(s)
        ? "Write a follow-up while this task runs…"
        : "Text goes here…",
      "aria-label": "Text goes here…",
      rows: 3,
      value: getDraft(),
      onInput: () => { resetHistory(); saveDraft(); },
      onPaste: (event) => {
        if (pendingSubmissions.has(draftKey())) return;
        const clipboard = event.clipboardData;
        const files = window.QuixiChat.clipboardImages(clipboard);
        if (!files.length) return; // Leave ordinary text paste to the browser.
        event.preventDefault();
        resetHistory();
        const key = draftKey();
        const items = window.QuixiChat.queueFiles(files, () => { if (draftKey() === key) renderChips(); });
        state.attachments.push(...items);
        const text = clipboard?.getData("text/plain");
        if (text) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
        saveDraft(); renderChips();
      },
      onKeydown: (e) => {
        if (recallPrompt(e)) return;
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          sendPrompt("queue");
        }
      },
    });
    const fileInput = el("input", {
      type: "file",
      multiple: true,
      id: "attachment-input",
      disabled: pendingSubmissions.has(draftKey()),
      class: "hidden",
      accept: window.QuixiChat.accept,
      onChange: (e) => {
        const key = draftKey();
        const items = window.QuixiChat.queueFiles(e.target.files, () => {
          if (draftKey() === key) renderChips();
        });
        state.attachments.push(...items);
        saveDraft(); renderChips(); e.target.value = "";
      },
    });
    // Approvals: three modes, named for what they do to your day rather than for the flag in the
    // engine. Manual asks every time. Smart lets the agent act and keeps asking about the things
    // that write or run. YOLO never asks — it is the honest name for bypassPermissions, and it is
    // in the list because pretending it does not exist only sends people looking for it.
    const mode = select(
      [
        ["default", "Manual"],
        ["auto", "Smart"],
        ["bypassPermissions", "YOLO"],
      ],
      s?.permissionMode || state.permission,
      async (v) => {
        state.permission = v;
        localStorage.setItem("quixi.permission", v);
        if (s) await rpc(service(s), "setPermissionMode", [s.sessionId, v]);
      },
      { "aria-label": "Approvals", title: "Manual asks every time. Smart decides from what you have already allowed. YOLO never asks." },
    );

    const send = button(running(s) ? "Queue" : "Send", () => sendPrompt(), "primary", "arrow");
    send.id = "send-button";
    const stop = button("Stop", () => stopTask(), "quiet", "stop");
    stop.id = "stop-button";
    stop.title = "Stop this response. Pending messages are kept on hold.";
    stop.hidden = !running(s);
    const steer = button("Guide current task", () => {
      document.getElementById("send-options")?.removeAttribute("open");
      sendPrompt("steer");
    }, "quiet");
    steer.id = "steer-button";
    steer.title = "Apply at the next safe boundary; running tools finish first.";
    const options = el("details", {id:"send-options", class:"send-options"},
      el("summary", {"aria-label":"More send options", title:"More send options"}, "⌄"),
      el("div", {class:"send-options-menu"}, steer));
    options.hidden = !running(s);
    const chooseModel = button(
      [
        el("span", {}, state.providers?.activeModel || "Choose model"),
        el("span", { class: "chevron", "aria-hidden": "true" }, "⌄"),
      ],
      () => modelPicker(),
      "quiet model-picker-trigger",
    );
    chooseModel.setAttribute("aria-label", "Choose model");
    chooseModel.title = state.providers?.activeModel || "Choose model";
    return el(
      "div",
      { class: "composer-wrap" },
      // The task list is docked above the composer rather than living on the empty screen. Sending
      // a message replaces the empty state with the transcript, and a list that disappears exactly
      // when the work starts is not a list anybody works from — it has to stay while the agent is
      // thinking, and while it is answering. It can be turned off in Settings → Visuals.
      localStorage.getItem("quixi.showTasks") === "0" ? null : tasksWidget(),
      el(
        "div",
        { class: "composer" },
        (() => {
          // An explicit corner grip, because the native one WebKit draws for a resizable textarea is
          // invisible against these panels — which is exactly what "I don't see that this is
          // resizable" means. This one is a real element and it drags both axes.
          const grip = el("div", { class: "resize-grip", title: "Drag to resize", "aria-hidden": "true" });
          grip.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            grip.setPointerCapture(event.pointerId);
            const startW = ta.getBoundingClientRect().width;
            const startH = ta.getBoundingClientRect().height;
            const startX = event.clientX;
            const startY = event.clientY;
            const move = (ev) => {
              ta.style.width = `${Math.max(180, Math.min(ta.parentElement.clientWidth - 26, startW + (ev.clientX - startX)))}px`;
              const maxH = Math.round(window.innerHeight * 0.6);
              ta.style.height = `${Math.max(70, Math.min(maxH, startH + (ev.clientY - startY)))}px`;
            };
            const up = () => {
              grip.removeEventListener("pointermove", move);
              grip.removeEventListener("pointerup", up);
              localStorage.setItem("quixi.composerH", ta.style.height);
              localStorage.setItem("quixi.composerW", ta.style.width);
            };
            grip.addEventListener("pointermove", move);
            grip.addEventListener("pointerup", up);
          });
          const h = localStorage.getItem("quixi.composerH");
          const w = localStorage.getItem("quixi.composerW");
          if (h) ta.style.height = h;
          if (w) ta.style.width = w;
          return grip;
        })(),
        el("div", { class: "chips", id: "attachment-chips" }),
        ta,
        fileInput,
        el(
          "div",
          { class: "composer-tools" },
          ib("Attach files", "plus", () => fileInput.click()),
          voiceControls(ta),

          approvalDropdown(s?.permissionMode || state.permission, async (v) => {
            state.permission = v;
            localStorage.setItem("quixi.permission", v);
            if (s) await rpc(service(s), "setPermissionMode", [s.sessionId, v]);
          }),
          el("span", { class: "spacer" }),
          el("span", { class: "model-control" }, needsOnboarding() ? null : chooseModel),
          stop,
          send,
          options,
        ),
      ),
      el("div", {id:"pending-messages", "aria-label":"Pending messages"}, ...pendingMessageRows(s)),
      el("p", { class: "composer-note", id:"composer-note" },
        running(s) ? "Enter to queue · Shift+Enter for a new line" : "Enter to send · Shift+Enter for a new line"),
    );
  }
  // --- Speaking replies aloud -------------------------------------------------
  // A toggle, not a settings trip. It reads the reply that just landed, and it stops the moment you
  // click it again or send something new — a voice that keeps going after you have moved on is the
  // worst kind of assistant.
  let speaking = false;
  function speakOn() { return localStorage.getItem("quixi.speak") === "1"; }
  function speakableText(raw) {
    return String(raw || "")
      .replace(/```[\s\S]*?```/g, " code block. ")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "image")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s*/gm, "")
      .replace(/[*_>#|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  }
  let speakGeneration = 0;
  async function speakReply(raw) {
    if (!speakOn()) return;
    const text = speakableText(raw);
    if (!text) return;
    // WebKitGTK has no speechSynthesis at all — the engine's own voice service is the only way to
    // make sound here, so this goes through /api/quixi/voice/speak. It is synchronous per chunk by
    // design: that is what lets "stop" take effect between sentences instead of after the reply.
    const generation = ++speakGeneration;
    speaking = true;
    syncSpeakButton();
    const chunks = text.match(/[^.!?]{1,240}[.!?]?/g) || [text];
    for (const chunk of chunks) {
      if (generation !== speakGeneration) return;
      const line = chunk.trim();
      if (!line) continue;
      try {
        await api("/api/quixi/voice/speak", { text: line });
      } catch (error) {
        toast(`Speech: ${error.message}`, true);
        break;
      }
    }
    if (generation === speakGeneration) {
      speaking = false;
      syncSpeakButton();
    }
  }
  function stopSpeaking() {
    // Bumping the generation abandons the remaining chunks; the engine finishes only the one it is
    // already speaking, which is at most a sentence.
    speakGeneration += 1;
    speaking = false;
    syncSpeakButton();
  }
  function syncSpeakButton() {
    const btn = document.getElementById("speak-toggle");
    if (!btn) return;
    const on = speakOn();
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on ? "Replies are read aloud — click to stop" : "Read replies aloud";
    btn.replaceChildren(icon(on ? "speaker" : "speakerOff", 14), el("span", {}, on ? "Speak" : "Speak"));
  }
  // Approvals as one control that names itself. The word "Approvals" is IN the button — a bare
  // "Manual" sitting next to a tiny uppercase caption made people ask what the caption was for, and
  // a caption is not a label when the value beside it is the only thing that looks clickable.
  function approvalDropdown(initial, onPick) {
    const NAMES = { default: "Manual", auto: "Smart", bypassPermissions: "YOLO" };
    let value = NAMES[initial] ? initial : "default";
    const wrap = el("div", { class: "approval-dd" });
    const button = el("button", { class: "approval-button", type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" });
    const menu = el("div", { class: "approval-menu", role: "listbox", hidden: true });
    const paint = () => {
      // Closed, the button says only APPROVALS and a caret. The mode word belongs in the menu: a
      // control that answers its own question before it is opened reads as a label, not a control.
      button.replaceChildren(
        el("span", { class: "approval-name" }, "Approvals"),
        el("span", { class: "approval-caret", "aria-hidden": "true" }, "\u2304"),
      );
      button.classList.toggle("is-open", !menu.hidden);
      menu.replaceChildren(
        ...Object.entries(NAMES).map(([key, label]) =>
          el(
            "button",
            {
              class: "approval-option" + (key === value ? " is-current" : ""),
              type: "button",
              role: "option",
              "aria-selected": key === value ? "true" : "false",
              onclick: () => {
                value = key;
                menu.hidden = true;
                button.setAttribute("aria-expanded", "false");
                paint();
                onPick(key);
              },
            },
            el("span", { class: "approval-option-name" }, label),
            el("span", { class: "approval-option-note" },
              key === "default" ? "asks every time"
                : key === "auto" ? "decides from your history"
                : "never asks"),
            key === value ? icon("check", 12) : null,
          )),
      );
    };
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
      paint();
    });
    const closeOnOutside = (event) => {
      if (!wrap.contains(event.target)) close();
    };
    const close = () => {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      paint();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    wrap.addEventListener("DOMNodeRemovedFromDocument", () => document.removeEventListener("pointerdown", closeOnOutside));
    menu.hidden = true;
    paint();
    wrap.append(button, menu);
    return wrap;
  }

  // --- Mic and Speaker, as two switches ---------------------------------------
  // The dictation state is MODULE-level, not per-render. It used to live in the control's closure,
  // and every re-render built a fresh control that knew nothing: the engine was still recording, the
  // button said Mic again, and pressing it opened a second capture — which is what "the toggle is
  // not smooth" looks like from the outside.
  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const withTimeout = (promise, ms, fallback) =>
    Promise.race([promise, sleepMs(ms).then(() => fallback)]);
  const DICTATION = { phase: "idle", baseline: "", live: "", level: 0, speech: false, timer: null };

  const dictationPainters = new Set();
  function repaintDictation() {
    for (const entry of dictationPainters) {
      // A re-render leaves the previous control behind; drop it rather than painting a detached node
      // for the rest of the session.
      if (!entry.node.isConnected) {
        dictationPainters.delete(entry);
        continue;
      }
      try { entry.paint(); } catch {}
    }
  }
  function dictationComposer() {
    return document.getElementById("prompt");
  }
  const dictationPoll = async () => {
    if (DICTATION.phase !== "listening") return;
    try {
      const status = await withTimeout(rpc("Voice", "dictationStatus"), 2500, null);
      if (DICTATION.phase !== "listening") return;
      if (status) {
        DICTATION.level = Number(status.level) || 0;
        DICTATION.speech = Boolean(status.in_speech);
        if (typeof status.transcript === "string") DICTATION.live = status.transcript;
        repaintDictation();
      }
    } catch {}
    if (DICTATION.phase === "listening") DICTATION.timer = setTimeout(dictationPoll, 250);
  };
  async function startDictation() {
    if (DICTATION.phase !== "idle") return;
    DICTATION.phase = "listening";
    DICTATION.elapsed = 0;
    DICTATION.level = 0;
    DICTATION.speech = false;
    repaintDictation();
    const opened = await withTimeout(
      rpc("Voice", "startDictation").catch((e) => ({ ok: false, error: e.message })),
      6000,
      { ok: false, error: "the engine did not answer" },
    );
    if (!opened || opened.ok === false) {
      DICTATION.phase = "idle";
      repaintDictation();
      toast(`The microphone did not open: ${(opened && opened.error) || "no answer from the engine"}`, true);
      return;
    }
    try {
      const before = await withTimeout(rpc("Voice", "getTranscript"), 4000, null);
      DICTATION.baseline = (before && before.transcript) || "";
    } catch { DICTATION.baseline = ""; }
    DICTATION.live = DICTATION.baseline;
    dictationPoll();
  }
  async function stopDictation() {
    if (DICTATION.phase !== "listening") return;
    DICTATION.phase = "stopping";
    DICTATION.stoppingSince = Date.now();
    clearTimeout(DICTATION.timer);
    repaintDictation();
    // The engine closes the open utterance before it releases the microphone, so the last sentence
    // is part of the transcript rather than stranded in a segment that never ended.
    await withTimeout(rpc("Voice", "stopDictation").catch(() => null), 6000, null);
    // Wait for the final pass, on a clock, and keep the partial as insurance: if Whisper is still
    // working after six seconds, the words it has already produced are better than nothing.
    // Fast path: the partial pass has already transcribed most of what was said, so put it in the
    // box now rather than making somebody wait for a full re-read of the same audio. The final pass
    // replaces that exact range when it lands, so the correction is invisible if there is nothing to
    // correct.
    const target = dictationComposer();
    let provisional = null;
    const first = await withTimeout(rpc("Voice", "dictationStatus").catch(() => null), 1200, null);
    if (first && typeof first.partial === "string" && first.partial.trim() && target) {
      const at = target.selectionStart ?? target.value.length;
      const stopAt = target.selectionEnd ?? at;
      const prefix = at && !/\s/.test(target.value[at - 1] || "") ? " " : "";
      const text = first.partial.trim();
      target.setRangeText(prefix + text, at, stopAt, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      provisional = { node: target, start: at + prefix.length, end: at + prefix.length + text.length, text };
      DICTATION.elapsed = Math.max(0, Math.round((Date.now() - DICTATION.stoppingSince) / 1000));
      repaintDictation();
    }

    const deadline = Date.now() + 6000;
    const startedWaiting = Date.now();
    let partial = "";
    while (Date.now() < deadline) {
      const status = await withTimeout(rpc("Voice", "dictationStatus").catch(() => null), 2000, null);
      if (status) {
        if (typeof status.transcript === "string") DICTATION.live = status.transcript;
        if (typeof status.partial === "string" && status.partial) partial = status.partial;
        DICTATION.elapsed = Math.max(0, Math.round((Date.now() - DICTATION.stoppingSince) / 1000));
        repaintDictation();
        // "Not transcribing" is not the same as "nothing left to transcribe": the flush is queued
        // before the worker picks it up, so the first read can say idle while the words are still on
        // their way. Only stop waiting when there is new text, or when a moment has passed and the
        // recogniser is genuinely quiet.
        const haveText = (DICTATION.live || "").length > (DICTATION.baseline || "").length || partial.length > 0;
        const settled = !status.transcribing && Date.now() - startedWaiting > 1200;
        if (haveText && !status.transcribing) break;
        if (settled) break;
      }
      await sleepMs(150);
    }
    const whole = String(DICTATION.live || "") || partial;
    if (provisional) {
      // Replace the provisional text with the final read, but only if the box still holds exactly
      // what was put there — if somebody has typed over it, their words win.
      const settledText = whole.trim();
      const node = provisional.node;
      const untouched =
        node.isConnected &&
        node.value.slice(provisional.start, provisional.end) === provisional.text;
      if (untouched && settledText && settledText !== provisional.text) {
        node.setRangeText(settledText, provisional.start, provisional.end, "end");
        node.dispatchEvent(new Event("input", { bubbles: true }));
      }
      provisional = null;
      DICTATION.baseline = "";
      DICTATION.live = "";
      DICTATION.phase = "idle";
      DICTATION.elapsed = 0;
      repaintDictation();
      return;
    }
    let fresh = DICTATION.baseline && whole.startsWith(DICTATION.baseline)
      ? whole.slice(DICTATION.baseline.length)
      : whole;
    fresh = fresh.trim();
    DICTATION.baseline = "";
    DICTATION.live = "";
    DICTATION.level = 0;
    DICTATION.speech = false;
    DICTATION.phase = "idle";
    DICTATION.elapsed = 0;
    repaintDictation();
    if (fresh && target) {
      const at = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? at;
      const prefix = at && !/\s/.test(target.value[at - 1] || "") ? " " : "";
      const suffix = end < target.value.length && !/\s/.test(target.value[end] || "") ? " " : "";
      target.setRangeText(prefix + fresh + suffix, at, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.focus();
    } else if (!fresh) {
      toast("Nothing was transcribed. The meter shows whether the microphone is hearing anything.");
    }
  }

  function voiceControls() {
    const bar = el("div", { class: "voice-controls" });
    const chip = el("span", { class: "conversation-chip", hidden: true }, "Conversation");
    const meterFill = el("i");
    const meter = el("span", { class: "mic-meter", title: "Input level" }, meterFill);
    const mic = el("button", { class: "device-button", type: "button", "aria-pressed": "false" });
    const speaker = el("button", { class: "device-button", type: "button", "aria-pressed": "false" });

    const paint = () => {
      const phase = DICTATION.phase;
      const speakerOn = localStorage.getItem("quixi.speak") === "1";
      const wait = DICTATION.elapsed ? ` ${DICTATION.elapsed}s` : "";
      const label = phase === "listening" ? "Listening" : phase === "stopping" ? `Transcribing…${wait}` : "Mic";
      mic.replaceChildren(icon(phase === "listening" ? "mic" : "micOff", 14), el("span", {}, label));
      mic.classList.toggle("is-on", phase === "listening");
      mic.classList.toggle("is-busy", phase === "stopping");
      mic.setAttribute("aria-pressed", phase === "listening" ? "true" : "false");
      mic.title =
        phase === "listening"
          ? "Recording — click to stop and put it in the box"
          : phase === "stopping"
            ? "Finishing the last sentence"
            : "Dictate: click to start, click again to stop";
      meter.hidden = phase !== "listening";
      meter.classList.toggle("is-speech", DICTATION.speech);
      meterFill.style.width = `${Math.max(2, Math.min(100, DICTATION.level))}%`;
      speaker.replaceChildren(icon(speakerOn ? "speaker" : "speakerOff", 14), el("span", {}, speakerOn ? "Speaking" : "Speaker"));
      speaker.classList.toggle("is-on", speakerOn);
      speaker.setAttribute("aria-pressed", speakerOn ? "true" : "false");
      speaker.title = speakerOn ? "Replies are read aloud — click to stop" : "Read replies aloud";
      chip.hidden = !(phase === "listening" && speakerOn);
    };

    mic.addEventListener("click", () => {
      if (DICTATION.phase === "listening") stopDictation();
      else if (DICTATION.phase === "idle") startDictation();
    });
    speaker.addEventListener("click", () => {
      const on = localStorage.getItem("quixi.speak") === "1";
      localStorage.setItem("quixi.speak", on ? "0" : "1");
      if (on) stopSpeaking();
      paint();
    });

    dictationPainters.add({ node: mic, paint });
    bar.append(mic, meter, chip, speaker);
    paint();
    return bar;
  }

  function speakControl() {
    const btn = el("button", {
      id: "speak-toggle",
      class: "speak-toggle",
      type: "button",
      onclick: () => {
        const next = !speakOn();
        localStorage.setItem("quixi.speak", next ? "1" : "0");
        if (!next) stopSpeaking();
        syncSpeakButton();
      },
    });
    queueMicrotask(syncSpeakButton);
    return btn;
  }

  function renderChips() {
    const target = document.getElementById("attachment-chips");
    target?.replaceChildren(
      ...state.attachments.map((f, i) =>
        el(
          "span",
          { class: "chip" },
          f.preview ? el("img", {src:f.preview,alt:"",class:"attachment-thumbnail"}) : icon("file", 12),
          f.name,
          f.status === "loading" ? " · Loading…" : null,
          f.status === "error" ? el("span",{role:"alert"},f.error) : null,
          f.status === "error" ? button("Retry",()=>window.QuixiChat.retryAttachment(f,renderChips),"quiet") : null,
          f.mcp?.kind === "resource" ? button(f.mcp.subscribed ? "Stop following" : "Follow changes", () => followMcpResource(f, !f.mcp.subscribed), "quiet") : null,
          f.mcp?.stale ? button("Review update", () => refreshMcpAttachment(f), "quiet mcp-stale-context") : null,
          button(
            "×",
            async () => {
              if (f.mcp?.subscribed) await followMcpResource(f, false);
              window.QuixiChat.cancelAttachment(f);
              const index=state.attachments.indexOf(f);
              if(index>=0)state.attachments.splice(index, 1);
              saveDraft();renderChips();
            },
            "quiet",
          ),
        ),
      ),
    );
  }
  async function folderDialog() {
    const anchor=document.querySelector(".workspace-switch")?.getBoundingClientRect();
    const current = currentFolder();
    const input = el("input", {
      value: current,
      placeholder: "e.g. ~/Projects/my-project",
      "aria-label": "Workspace folder path",
    });
    const error = el("div", { class: "form-error", role: "alert" });
    const browse = button("Choose folder", async () => {
      const folder = await rpc(
        "LocalAgentModeSessions",
        "browseAndAddTrustedFolder",
        ["Choose a workspace folder"],
      );
      if (folder) input.value = folder;
      else toast("No folder selected. You can also enter a path below.");
    });
    const d = dialog("Choose workspace", [
      el(
        "p",
        {},
        "Tasks can inspect this folder. In Manual mode, QuixiDesk asks before changing files or running commands.",
      ),
      browse,
      current ? button("Use without a folder",async()=>{
        const s=session();if(s){const result=await rpc(service(s),"updateSession",[s.sessionId,{userSelectedFolders:[],cwd:"",spaceId:state.project}]);if(result?.error)throw new Error(result.error);await loadSessions();}state.folder="";d.close();renderPage();
      },"quiet") : null,
      field("Or enter a folder path", input),
      error,
      el(
        "div",
        { class: "form-actions" },
        button("Cancel", () => d.close(), "quiet"),
        button(
          "Use folder",
          async () => {
            try {
              const path = input.value.trim();
              const checked = await api("/api/quixi/workspace/inspect", {
                path,
              });
              if (!checked.exists)
                throw new Error("Choose an existing folder.");
              state.folder = checked.path;
              const s = session();
              if (s) {
                await rpc(service(s), "updateSession", [
                  s.sessionId,
                  {
                    userSelectedFolders: [state.folder],
                    spaceId: state.project,
                  },
                ]);
                await loadSessions();
              }
              d.close();
              renderPage();
            } catch (e) {
              error.textContent = e.message;
            }
          },
          "primary",
        ),
      ),
    ]);
    positionPopover(d,anchor);
  }
  const pendingSubmissions=new Set();
  async function sendPrompt(delivery = "queue") {
    const input = document.getElementById("prompt");
    if (!input) return;
    const text = input.value.trim();
    if (!text && !state.attachments.length) return;
    if (!state.providers?.hasConfiguredProvider) {
      providerDirectory();
      toast("Connect a provider before sending a task.");
      return;
    }
    if (!state.providers.activeModel) {
      modelPicker();
      toast("Choose a model before sending a task.");
      return;
    }
    if (state.attachments.some(file => file.mcp?.stale)) { toast("Review the updated MCP context before sending this message.", true); return; }
    const b = document.getElementById("send-button");
    if (b?.disabled || pendingSubmissions.has(draftKey())) return;
    if (b) b.disabled = true;
    const originKey=draftKey();
    const attached=state.attachments.slice();
    pendingSubmissions.add(originKey);
    input.disabled=true;
    try {
      capabilityUI.stopAudio();
      const attachments=window.QuixiChat.attachmentsForSend(attached);
      let s = session();
      if (!s) {
        const opts = {
          title: Array.from(text || attached[0]?.name || "New task").slice(0, 80).join(""),
          permissionMode: state.permission,
          spaceId: state.project,
          userSelectedFolders: currentFolder() ? [currentFolder()] : [],
          cwd: currentFolder() || "",
        };
        s = await rpc("LocalAgentModeSessions", "start", [opts]);
        if(!s?.sessionId)throw new Error(s?.error||"Conversation could not be created.");
        s._kind = "task";
        state.sessions.unshift(s);
      }
      state.stopped.delete(s.sessionId);
      const uuid = crypto.randomUUID();
      const wasRunning = running(s);
      const accepted = await rpc(service(s), "sendMessageV2", [s.sessionId, {text, attachments, messageUuid:uuid, delivery}]);
      if (accepted?.error) throw new Error(accepted.error);
      if (accepted?.queued) toast(delivery === "steer" ? "Steering sent — applies at the next safe boundary." : "Follow-up queued.");
      const stillHere=document.getElementById("prompt") && draftKey()===originKey;
      for (const key of [originKey]) {
        state.drafts.delete(key);state.attachmentDrafts.delete(key);
        sessionStorage.removeItem("quixi.draft."+key);
      }
      for(const file of attached)if(file.mcp?.subscribed)mcpRequest("subscribeResource",[file.mcp.server,file.mcp.uri,file.mcp.cwd,false]).catch(error=>toast(error.message,true));
      if(stillHere){state.attachments=[];document.getElementById("prompt").value="";}
      s.isRunning = true;
      if (!wasRunning) state.streams.set(s.sessionId, { text: "", thinking: "" });
      await refreshSession(s.sessionId);
      if(document.getElementById("prompt") && draftKey()===originKey){pendingSubmissions.delete(originKey);navigate("chat",s.sessionId);document.getElementById("prompt")?.focus();}
    } catch (e) {
      toast(e.message, true);
    } finally {
      pendingSubmissions.delete(originKey);input.disabled=false;
      if(draftKey()===originKey){const current=document.getElementById("prompt");if(current)current.disabled=false;const file=document.getElementById("attachment-input");if(file)file.disabled=false;}
      if (b) b.disabled = false;
    }
  }
  async function forkMessage(s,message,text) {
    if(running(s)){toast("Stop the current task before creating a branch.",true);return;}
    const branch=await rpc(service(s),"forkMessage",[s.sessionId,{messageUuid:message.uuid,...(text!==undefined?{text}: {})}]);
    if(!branch?.sessionId)throw new Error(branch?.error||"Could not create conversation branch.");
    branch._kind=s._kind;state.sessions.unshift(branch);navigate("chat",branch.sessionId);toast("Created a new branch. Your original conversation is preserved.");
  }
  function editMessage(s,message) {
    formDialog("Edit in a new branch",[{name:"text",label:"Message",multiline:true,value:window.QuixiChat.editableText(message),hint:"The original conversation stays intact. Existing attachments are kept.",required:true}],async(values)=>{
      if(!values.text.trim())throw new Error("Enter a message.");await forkMessage(s,message,values.text.trim());
    },{submit:"Send edited message"});
  }
  async function stopTask() {
    const s = session();
    if (!s) return;
    await rpc(service(s), "stop", [s.sessionId]);
    state.stopped.add(s.sessionId);
    state.streams.delete(s.sessionId);
    await refreshSession(s.sessionId);
    renderTranscript();
    updateSendButton();
  }
  function pendingMessageRows(s) {
    return (state.pendingMessages.get(s?.sessionId) || []).map(m => {
      const act = async (method, control) => {
        control.disabled = true;
        try {
          const result = await rpc(service(s), method, [s.sessionId, m.messageUuid]);
          if (result?.error) throw new Error(result.error);
          if (result?.cancelled === false) toast("This message has already been delivered.");
          await refreshSession(s.sessionId);
          if (session()?.sessionId === s.sessionId) { renderTranscript(); updateSendButton(); }
        } catch (error) { toast(error.message, true); }
        finally { control.disabled = false; }
      };
      const remove = button("Remove", () => act("cancelPendingMessage", remove), "quiet");
      const guide = button(running(s) ? "Guide task" : "Send now", () => act("guidePendingMessage", guide), "quiet");
      guide.title = running(s) ? "Apply at the next safe boundary; running tools finish first." : "Send this held message; other held messages stay on hold.";
      return el("div", {class:"pending-message"},
        el("div", {class:"pending-message-content"},
          el("span", {class:"pending-message-label"}, m.held ? "On hold" : m.delivery === "steer" ? "Guidance pending" : "Up next"),
          el("span", {class:"pending-message-text"}, m.text || "Attachments")),
        ...(m.delivery !== "steer" || m.held || !running(s) ? [guide] : []), remove);
    });
  }
  function updateSendButton() {
    const b = document.getElementById("send-button");
    if (!b) return;
    const active = running(session());
    b.className = "primary";
    b.replaceChildren(icon("arrow"), active ? "Queue" : "Send");
    b.disabled = pendingSubmissions.has(draftKey());
    const stop = document.getElementById("stop-button");
    if (stop) stop.hidden = !active;
    const options = document.getElementById("send-options");
    if (options) { options.hidden = !active; if (!active) options.removeAttribute("open"); }
    const steer = document.getElementById("steer-button");
    if (steer) steer.disabled = b.disabled;
    const note = document.getElementById("composer-note");
    if (note) note.textContent = active ? "Enter to queue · Shift+Enter for a new line" : "Enter to send · Shift+Enter for a new line";
    document.getElementById("pending-messages")?.replaceChildren(...pendingMessageRows(session()));
    const input = document.getElementById("prompt");
    if (input) input.placeholder = active ? "Add a follow-up…" : "Text goes here…";
  }
  async function refreshSession(id) {
    let old = state.sessions.find((s) => s.sessionId === id);
    if (!old) { await loadSessions(); old = state.sessions.find((s) => s.sessionId === id); }
    if (!old) return;
    const pending = await rpc(service(old), "getPendingMessages", [id]);
    state.pendingMessages.set(id, Array.isArray(pending) ? pending : []);
    const value = await rpc(service(old), "getSession", [id]);
    if (value) {
      Object.assign(old, value);
      state.approvals.set(
        id,
        (await rpc(service(old), "getToolPermissions", [id])) || [],
      );
      const children = await rpc(service(old), "listSubagents", [id]);
      state.subagents.set(id, Array.isArray(children) ? children : []);
      if (old._kind === "code")
        state.transcripts.set(
          id,
          (await rpc("LocalSessions", "getTranscript", [id])) || [],
        );
    }
    renderRecents();
  }
  async function openTranscript() {
    await refreshSession(state.id);
    renderTranscript();
    updateSendButton();
  }
  function textBlocks(message) {
    const content = message?.message?.content || message?.content || [];
    return typeof content === "string"
      ? [{ type: "text", text: content }]
      : Array.isArray(content)
        ? content
        : [];
  }
  // Render a small, safe Markdown subset as DOM nodes. Model text is never HTML.
  function inlineText(text) {
    const out = document.createDocumentFragment();
    text = String(text ?? "");
    // Bound inline parsing work. Unmatched delimiters must not trigger an
    // unanchored regex scan of the entire remaining response at every character.
    const pattern = /^(?:`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/;
    const matches = [];
    for (let i = 0; i < text.length;) {
      if (!"`*[".includes(text[i])) { i++; continue; }
      const match = text.slice(i, i + 1024).match(pattern);
      if (!match) { i++; continue; }
      match.index = i; matches.push(match); i += match[0].length;
    }
    let last = 0;
    for (const match of matches) {
      out.append(document.createTextNode(text.slice(last, match.index)));
      const token = match[0];
      if (token.startsWith("`")) out.append(el("code", {}, token.slice(1, -1)));
      else if (token.startsWith("**"))
        out.append(el("strong", {}, token.slice(2, -2)));
      else if (token.startsWith("*"))
        out.append(el("em", {}, token.slice(1, -1)));
      else {
        const [, label, url] = token.match(/^\[([^\]]+)\]\((.+)\)$/);
        const artifact = url.match(
          /^app:\/\/localhost\/cowork-artifact\/([a-zA-Z0-9-]+)$/,
        );
        if (artifact || /^https?:\/\//i.test(url)) {
          out.append(
            el(
              "a",
              {
                href: artifact ? "#" : url,
                onClick: (event) => {
                  event.preventDefault();
                  (artifact
                    ? openArtifact(artifact[1])
                    : openExternal(url)
                  ).catch((error) => toast(error.message, true));
                },
              },
              label,
            ),
          );
        } else out.append(document.createTextNode(token));
      }
      last = match.index + token.length;
    }
    out.append(document.createTextNode(text.slice(last)));
    return out;
  }
  function plainBody(text) {
    const box = el("div", { class: "body" });
    const normalized = String(text ?? "").replace(/\r\n?|[\u2028\u2029]/g, "\n");
    // Large responses remain complete and copyable without allocating an
    // unbounded Markdown DOM on every streaming update.
    if (normalized.length > 200000) {
      box.append(el("pre", {class:"plain-response"}, normalized));
      return box;
    }
    const lines = normalized.split("\n");
    const cells = (line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      if (/^\s*```/.test(line)) {
        const language = line.trim().slice(3).trim() || "Code";
        const code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i]))
          code.push(lines[i++]);
        if (i < lines.length) i++;
        const value = code.join("\n");
        box.append(
          el(
            "div",
            { class: "code-block" },
            el(
              "div",
              { class: "code-head" },
              el("span", {}, language),
              button("Copy code", () => copy(value), "quiet"),
            ),
            el("pre", {}, el("code", {}, value)),
          ),
        );
      } else if (/^#{1,6}\s/.test(line)) {
        const [, hashes, title] = line.match(/^(#{1,6})\s+(.*)$/);
        box.append(
          el("h" + Math.min(hashes.length + 1, 6), {}, inlineText(title)),
        );
        i++;
      } else if (
        i + 1 < lines.length &&
        line.includes("|") &&
        /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
      ) {
        const table = el(
          "table",
          {},
          el(
            "thead",
            {},
            el(
              "tr",
              {},
              ...cells(line).map((c) => el("th", {}, inlineText(c))),
            ),
          ),
        );
        const body = el("tbody", {});
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|"))
          body.append(
            el(
              "tr",
              {},
              ...cells(lines[i++]).map((c) => el("td", {}, inlineText(c))),
            ),
          );
        table.append(body);
        box.append(el("div", { class: "table-wrap" }, table));
      } else if (/^\s*([-*+] |\d+\. )/.test(line)) {
        const ordered = /^\s*\d+\. /.test(line);
        const list = el(
          ordered ? "ol" : "ul",
          ordered ? { start: line.match(/\d+/)[0] } : {},
        );
        const pattern = ordered ? /^\s*\d+\. (.*)$/ : /^\s*[-*+] (.*)$/;
        while (i < lines.length && pattern.test(lines[i]))
          list.append(
            el("li", {}, inlineText(lines[i++].replace(pattern, "$1"))),
          );
        box.append(list);
      } else if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i]))
          quote.push(lines[i++].replace(/^>\s?/, ""));
        box.append(el("blockquote", {}, inlineText(quote.join("\n"))));
      } else if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        box.append(el("hr"));
        i++;
      } else {
        const paragraph = [lines[i++]];
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\s*(#{1,6}\s|```|[-*+] |\d+\. |>)/.test(lines[i]) &&
          !(
            i + 1 < lines.length &&
            lines[i].includes("|") &&
            /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])
          )
        )
          paragraph.push(lines[i++]);
        box.append(el("p", {}, inlineText(paragraph.join("\n"))));
      }
    }
    return box;
  }
  // --- Smart mode: decide from history ----------------------------------------
  // "Smart" is not a mood, it is a record. Every approval you give is fingerprinted (tool + the
  // thing it acts on) and kept; in Smart, a request that matches something you have already allowed
  // goes straight through, and anything new still stops and asks. That is the whole rule, so it can
  // be explained in one sentence and predicted before it acts.
  function approvalFingerprint(request) {
    const input = request.input || {};
    const target = input.file_path || input.path || input.command || input.url || input.description || input.server || "";
    return `${request.toolName}::${String(target).trim().replace(/\/+$/, "")}`;
  }
  function approvalHistory() {
    try { return JSON.parse(localStorage.getItem("quixi.approvalHistory") || "[]"); }
    catch { return []; }
  }
  function rememberApproval(request) {
    const key = approvalFingerprint(request);
    const history = approvalHistory().filter((k) => k !== key);
    history.unshift(key);
    localStorage.setItem("quixi.approvalHistory", JSON.stringify(history.slice(0, 200)));
  }
  function approvedBefore(request) {
    return approvalHistory().includes(approvalFingerprint(request));
  }
  const autoApproving = new Set();

  function permissionCard(request, s) {
    const edit = ["Write", "Edit"].includes(request.toolName) && !request.outsideWorkspace;
    const input = request.input || {};
    const card = el(
      "section",
      { class: "permission-card", "aria-label": "Permission requested" },
      request.subagent ? el("p", {class:"hint"}, "Subagent: " + request.subagent.title + " · Approval applies to this conversation") : null,
      el("h3", {}, request.outsideWorkspace ? "Allow access outside this workspace?" : edit ? "Allow file changes?" : "Allow this action?"),
      el(
        "p",
        {},
        edit
          ? (request.toolName === "Write" ? "Create or update " : "Edit ") +
              (input.file_path || "file")
          : input.file_path || input.path || input.description ||
              input.command ||
              [request.toolName, input.server, input.tool]
                .filter(Boolean)
                .join(" · "),
      ),
      el(
        "details",
        {},
        el("summary", {}, edit ? "Review change" : "Review action"),
        el(
          "pre",
          {},
          request.toolName === "Write"
            ? input.content || "(empty file)"
            : JSON.stringify(input, null, 2),
        ),
      ),
      edit
        ? el(
            "p",
            { class: "hint" },
            "Allow file edits applies to this conversation. Shell commands will still ask.",
          )
        : null,
    );
    const decide = async (decision) => {
      if (decision !== "deny") rememberApproval(request);
      const buttons = [...card.querySelectorAll("button")];
      buttons.forEach((b) => (b.disabled = true));
      try {
        const r = await rpc(service(s), "resolveToolPermission", [
          s.sessionId,
          request.requestId,
          decision,
        ]);
        if (r?.error) throw new Error(r.error);
        await refreshSession(s.sessionId);
        renderTranscript();
        updateSendButton();
        const mode = document.querySelector(
          'select[aria-label="Tool permission mode"]',
        );
        if (mode) mode.value = session()?.permissionMode || state.permission;
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    card.append(
      el(
        "div",
        { class: "permission-actions" },
        button(
          "Allow once",
          () => decide("allow_once"),
          edit ? "quiet" : "primary",
        ),
        edit
          ? button(
              "Allow file edits",
              () => decide("allow_file_edits"),
              "primary",
            )
          : null,
        button("Deny", () => decide("deny"), "quiet"),
      ),
    );
    return card;
  }
  function toolActivity(group, active, opened) {
    const failed = group.steps.filter((s) => s.result?.is_error).length;
    const fileOnly = group.steps.every((s) =>
      ["Read", "ListDirectory", "Grep"].includes(s.call?.name),
    );
    const label = fileOnly
      ? active
        ? "Exploring files"
        : "File activity"
      : active
        ? "Working with tools"
        : "Tool activity";
    const node = group.node;
    node.className = "activity-group" + (failed ? " has-failures" : "");
    node.dataset.disclosure = group.key;
    node.open = opened.has(group.key);
    node.append(
      el(
        "summary",
        {},
        icon(fileOnly ? "folder" : "tools", 14),
        el("span", { class: "activity-label" }, label),
        el(
          "span",
          { class: "activity-count" },
          `${group.steps.length} action${group.steps.length === 1 ? "" : "s"}`,
        ),
        failed
          ? el("span", { class: "activity-failed" }, `${failed} failed`)
          : null,
        active
          ? el("span", {
              class: "activity-running",
              "aria-label": "In progress",
            })
          : null,
        el("span", { class: "activity-chevron", "aria-hidden": "true" }, "›"),
      ),
    );
    const rows = el("div", { class: "activity-steps" });
    for (const step of group.steps) {
      const call = step.call,
        result = step.result;
      const bad = !!result?.is_error;
      const input = call?.input || {};
      const path = input.file_path || input.path || sPath();
      const basename = String(path).split(/[\\/]/).filter(Boolean).pop() || ".";
      let title = call?.name || (bad ? "Tool action failed" : "Tool result");
      if (call?.name === "Read") title = "Read " + basename;
      else if (call?.name === "ListDirectory")
        title =
          "List " +
          (path === "."
            ? sPath().split(/[\\/]/).filter(Boolean).pop() || "folder"
            : basename);
      else if (call?.name === "Grep")
        title = "Search " + (input.query || "workspace");
      else if (call?.name === "Bash")
        title = input.description || "Run command";
      else if (["Write", "Edit"].includes(call?.name))
        title = call.name + " " + basename;
      else if (call?.name === "McpCall")
        title =
          [input.server, input.tool].filter(Boolean).join(" · ") ||
          "Connected tool";
      const awaiting = state.approvals
        .get(session()?.sessionId)
        ?.some((r) => r.toolCallId === step.id);
      const status = result
        ? bad
          ? "Failed"
          : "Completed"
        : awaiting
          ? "Awaiting approval"
          : active
            ? "Running…"
            : "No result recorded";
      const key = group.key + "/" + step.id;
      const row = el(
        "details",
        {
          class: "tool-card tool-step" + (bad ? " failed" : ""),
          "data-disclosure": key,
          open: opened.has(key),
        },
        el(
          "summary",
          {},
          icon(bad ? "close" : result ? "check" : "tools", 12),
          el("span", { class: "tool-step-title", title }, title),
          el("small", { class: "tool-step-status" }, status),
        ),
      );
      if (call)
        row.append(
          el(
            "div",
            { class: "tool-step-body" },
            el("small", {}, "Input"),
            el("pre", {}, JSON.stringify(input, null, 2)),
          ),
        );
      if (result)
        row.append(
          el(
            "div",
            { class: "tool-step-body" },
            el("small", {}, bad ? "Error" : "Result"),
            toolResultView(result.content),
          ),
        );
      rows.append(row);
    }
    node.append(rows);
    function sPath() {
      return session()?.cwd || currentFolder() || ".";
    }
  }
  function renderTranscript() {
    const target = document.getElementById("conversation");
    const s = session();
    if (!target || !s) return;
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 90;
    const oldScroll = target.scrollTop;
    const messages =
      s._kind === "code"
        ? state.transcripts.get(s.sessionId) || []
        : s.bufferedMessages || [];
    const seen = new Set();
    const result = [];
    const opened = new Set(
      [...target.querySelectorAll("details[open][data-disclosure]")].map(
        (n) => n.dataset.disclosure,
      ),
    );
    const groups = [];
    let group = null,
      turnKey = "initial";
    for (const [messageIndex, message] of messages.entries()) {
      if (message.type === "result" || message.type === "stream_event")
        continue;
      const id = message.uuid;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const blocks = textBlocks(message);
      const texts = blocks
        .filter((b) => b.type === "text" && !b.attachment)
        .map((b) => b.text || "")
        .join("\n");
      const role = message.type === "user" ? "user" : "assistant";
      const tools = blocks.filter(
        (b) => b.type === "tool_use" || b.type === "tool_result",
      );
      if ((texts || window.QuixiChat.transcriptAttachments(message).length) && role === "user") {
        group = null;
        turnKey = id || "message-" + messageIndex;
      }
      const attachedFiles=window.QuixiChat.transcriptAttachments(message);
      if (texts || attachedFiles.length) {
        const article = el(
          "article",
          { class: "message " + role },
          el(
            "div",
            { class: "role" },
            role === "user"
              ? "You"
              : message.message?.stop_reason === "user_stop"
                ? speakerName() + " · Stopped"
                : speakerName(),
          ),
          plainBody(texts),
          attachedFiles.length ? el("div",{class:"transcript-attachments"},...attachedFiles.map(f=>el("div",{class:"chip"},f.preview?el("img",{src:f.preview,alt:f.name,class:"transcript-image"}):icon("file",14),f.name))) : null,
          el(
            "div",
            { class: "message-actions" },
            button(
              "Copy",
              async () => {
                await copy(texts);
                toast("Copied message.");
              },
              "quiet",
            ),
            role === "assistant" ? capabilityUI.readAloudControl(texts) : null,
            role === "user" && id ? button("Edit",()=>editMessage(s,message),"quiet") : null,
            id ? button("Retry",()=>forkMessage(s,message),"quiet") : null,
          ),
        );
        result.push(article);
      }
      for (const [toolIndex, tool] of tools.entries()) {
        if (!group) {
          group = {
            key: "activity-" + turnKey,
            node: el("details"),
            steps: [],
            byId: new Map(),
          };
          groups.push(group);
          result.push(group.node);
        }
        const key =
          tool.id ||
          tool.tool_use_id ||
          `unlinked-${messageIndex}-${toolIndex}`;
        let step = group.byId.get(key);
        if (!step) {
          step = { id: key };
          group.byId.set(key, step);
          group.steps.push(step);
        }
        if (tool.type === "tool_use") step.call = tool;
        else step.result = tool;
      }
    }
    for (const activity of groups)
      toolActivity(activity, activity === group && running(s), opened);
    const stream = state.streams.get(s.sessionId);
    if (stream && running(s)) {
      if (stream.thinking)
        result.push(
          el(
            "details",
            { class: "thinking" },
            el("summary", {}, "Thinking"),
            stream.thinking,
          ),
        );
      if (stream.text)
        result.push(
          el(
            "article",
            { class: "message assistant" },
            el("div", { class: "role" }, speakerName()),
            plainBody(stream.text),
          ),
        );
      result.push(
        el(
          "div",
          { class: "live-status", role: "status" },
          el("span", { class: "pulse" }),
          "Working…",
        ),
      );
    }
    const children = state.subagents.get(s.sessionId) || [];
    if (children.length) {
      const panel = el("details", {class:"subagent-panel", "data-disclosure":"subagents", open:opened.has("subagents")},
        el("summary", {}, "Subagents · " + children.length + (children.some(c=>c.status==="running") ? " · Working" : children.some(c=>["failed", "interrupted"].includes(c.status)) ? " · Returned to agent" : children.some(c=>c.status==="cancelled") ? " · Stopped" : " · Complete")));
      for (const child of children) panel.append(el("div", {class:"subagent-row"},
        el("div", {class:"grow"}, el("strong", {}, child.title),
          el("p", {class:"hint"}, [["failed", "interrupted"].includes(child.status) ? "Returned to parent agent" : child.status, child.readOnly ? "Read-only" : "Workspace tools", child.model, `${child.toolCalls || 0} tool call${child.toolCalls === 1 ? "" : "s"}`].filter(Boolean).join(" · ")),
          null),
        button("View activity", async()=>{
          const task = await rpc(service(s), "getSubagent", [s.sessionId, child.agentId]);
          if (!task) throw new Error("Subagent activity is unavailable.");
          const body = el("div", {class:"subagent-history"}, el("p", {class:"hint"}, "Assignment and recorded activity"), plainBody(task.prompt || ""));
          if (task.error) body.append(el("p", {class:"hint"}, "Internal diagnostic (handled by the parent agent): " + task.error));
          for (const message of task.messages || []) {
            if (message.content) body.append(el("details", {}, el("summary", {}, message.role === "tool" ? (message.is_error ? "Tool failed" : "Tool result") : "Subagent response"), el("pre", {}, typeof message.content === "string" ? message.content : JSON.stringify(message.content))));
            for (const call of message.tool_calls || []) body.append(el("details", {}, el("summary", {}, call.function.name), el("pre", {}, call.function.arguments)));
          }
          dialog(task.title, body);
        }, "quiet")));
      result.push(panel);
    }
    for (const request of state.approvals.get(s.sessionId) || []) {
      const mode = s.permissionMode || state.permission;
      if (mode === "auto" && approvedBefore(request) && !autoApproving.has(request.requestId)) {
        autoApproving.add(request.requestId);
        rpc(service(s), "resolveToolPermission", [s.sessionId, request.requestId, "allow_once"])
          .then(() => refreshSession(s.sessionId))
          .then(() => { renderTranscript(); updateSendButton(); })
          .catch(() => autoApproving.delete(request.requestId));
        continue;
      }
      result.push(permissionCard(request, s));
    }
    if (state.stopped.has(s.sessionId) && !running(s))
      result.push(
        el(
          "div",
          { class: "live-status", role: "status" },
          icon("stop", 14),
          "Response stopped.",
        ),
      );
    if (s.error)
      result.push(
        el(
          "div",
          { class: "notice error-text", role: "alert" },
          typeof s.error === "string" ? s.error : JSON.stringify(s.error),
        ),
      );
    if (!result.length)
      result.push(
        empty(
          "Ready when you are",
          "Send a prompt to start this conversation.",
        ),
      );
    target.replaceChildren(...result);
    refreshConversationFind(false);
    if (nearBottom) target.scrollTop = target.scrollHeight;
    else target.scrollTop = oldScroll;
  }
  function deleteSession(s) {
    confirmDialog(
      "Delete conversation?",
      `Permanently remove “${s.title || "Untitled task"}” and its stored recovery copy? This cannot be undone.`,
      async () => {
        const result = await rpc(service(s), "delete", [s.sessionId]);
        if (result?.error || result === false) throw Error(result?.error || "Conversation could not be deleted.");
        state.transcripts.delete(s.sessionId);
        state.drafts.delete(s.sessionId);
        state.attachmentDrafts.delete(s.sessionId);
        await loadSessions();
        if (state.id === s.sessionId) navigate("new");
        else renderPage();
        toast("Conversation deleted.");
      },
    );
  }
  function deleteProject(p) {
    confirmDialog("Delete project?",
      `Remove “${p.name}” and its project instructions? Conversations and files in its folders will be kept. This cannot be undone.`,
      async () => {
        const result = await rpc("CoworkSpaces", "deleteSpace", [p.id]);
        if (result?.error || result !== true) throw Error(result?.error || "Project could not be deleted.");
        if (state.project === p.id) state.project = null;
        await loadProjects();
        if (state.page === "project" && state.id === p.id) navigate("projects");
        else renderPage();
        toast("Project deleted. Conversations and files kept.");
      });
  }
  async function sessionMenu(s) {
    s = state.sessions.find((current) => current.sessionId === s.sessionId) || s;
    const d = dialog("Task actions", [
      el("p", {}, s.title),
      el(
        "div",
        { class: "field-stack" },
        button("Prompt diagnostics", async () => {
          try {
            const response = await fetch(`/api/quixi/prompt-context/${encodeURIComponent(s.sessionId)}`);
            const context = await response.json();
            if (!response.ok) throw Error(context.error || "Diagnostics unavailable");
            dialog("Prompt diagnostics", [
              el("p", {class:"hint"}, "Latest tool-enabled model request. Instruction text and tool arguments are not stored here."),
              el("pre", {class:"code-preview"}, JSON.stringify(context, null, 2)),
            ], {wide:true});
          } catch (error) { toast(error.message); }
        }),
        button("Rename", () => {
          d.close();
          formDialog(
            "Rename task",
            [
              {
                name: "title",
                label: "Task title",
                value: s.title,
                required: true,
              },
            ],
            async (values) => {
              await rpc(service(s), "updateSession", [
                s.sessionId,
                { title: values.title.trim() },
              ]);
              await loadSessions();
              render();
            },
          );
        }),
        button(s.isStarred ? "Unpin task" : "Pin task", async () => {
          await rpc(service(s), "updateSession", [
            s.sessionId,
            { isStarred: !s.isStarred },
          ]);
          await loadSessions();
          d.close();
        }),
        button(s.isArchived ? "Restore task" : "Archive task", async () => {
          await rpc(service(s), s.isArchived ? "unarchive" : "archive", [
            s.sessionId,
          ]);
          await loadSessions();
          d.close();
          if (state.id === s.sessionId) navigate("new");
          else renderPage();
        }),
        button(
          "Delete task",
          () => {
            d.close();
            deleteSession(s);
          },
          "danger",
        ),
      ),
    ]);
  }
  function header(title, description, action) {
    return el(
      "div",
      { class: "page-header" },
      el("div", {}, el("h1", {}, title), el("p", {}, description)),
      action,
    );
  }
  function projectEditor(p) {
    formDialog(
      p ? "Edit project" : "New project",
      [
        { name: "name", label: "Project name", value: p?.name, required: true },
        { name: "description", label: "Description", value: p?.description },
        {
          name: "instructions",
          label: "Project instructions",
          value: p?.instructions,
          multiline: true,
          hint: "Included in the context of tasks started inside this project.",
        },
      ],
      async (values) => {
        if (!values.name.trim()) throw new Error("Enter a project name.");
        const saved = await rpc(
          "CoworkSpaces",
          p ? "updateSpace" : "createSpace",
          p ? [p.id, values] : [values],
        );
        if (saved?.error || !saved?.id) throw Error(saved?.error || "Project could not be saved.");
        await loadProjects();
        navigate("project", saved.id);
      },
    );
  }
  function projectDetail(p) { navigate("project", p.id); }
  function manageProjectFolders(p) {
    const folderError = el("p", { class: "form-error", role: "alert" });
    const addFolder = async (path) => {
      const check = await api("/api/quixi/workspace/inspect", { path });
      if (!check.exists) throw new Error("Choose an existing folder.");
      if (p.folders?.some((folder) => folder.path === check.path))
        throw new Error("This folder is already in the project.");
      const added = await rpc("CoworkSpaces", "addFolderToSpace", [p.id, check.path]);
      if (!added || added.error) throw new Error(added?.error || "The folder could not be added. Try again.");
      await loadProjects();
      d.close();
      manageProjectFolders(state.projects.find((x) => x.id === p.id));
    };
    const rows = el(
      "div",
      { class: "field-stack" },
      ...(p.folders || []).map((f) =>
        el(
          "div",
          { class: "list-row" },
          icon("folder"),
          el("span", { class: "path grow" }, f.path),
          button(
            "Remove",
            async () => {
              await rpc("CoworkSpaces", "removeFolderFromSpace", [
                p.id,
                f.path,
              ]);
              await loadProjects();
              d.close();
              manageProjectFolders(state.projects.find((x) => x.id === p.id));
            },
            "quiet",
          ),
        ),
      ),
    );
    const d = dialog(p.name, [
      el("p", {}, p.description),
      p.instructions
        ? el(
            "details",
            {},
            el("summary", {}, "Project instructions"),
            el("pre", {}, p.instructions),
          )
        : null,
      el("h3", {}, "Folders"),
      rows,
      el("div", { class: "form-actions" },
      button("Add folder", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        folderError.textContent = "";
        try {
          const path = await rpc("LocalAgentModeSessions", "browseAndAddTrustedFolder", ["Add a project folder"]);
          if (path) await addFolder(path);
        } catch (error) { folderError.textContent = error.message; }
        finally { button.disabled = false; }
      }, "primary", "folder"),
      button("Enter path", () =>
        formDialog(
          "Add project folder",
          [{ name: "path", label: "Folder path", required: true,
            placeholder: "e.g. ~/Projects/my-project", hint: "Paste a full path or use ~ for your home folder." }],
          async (values) => addFolder(values.path),
          { submit: "Add folder" },
        ),
      "quiet")),
      folderError,
      el("hr"),
      el(
        "div",
        { class: "form-actions" },
        button(
          "Delete project",
          () => {
            d.close();
            confirmDialog(
              "Delete project?",
              `Remove “${p.name}”? Conversations and files remain on disk.`,
              async () => {
                const result=await rpc("CoworkSpaces", "deleteSpace", [p.id]);
                if(!result || result.error)throw new Error(result?.error || "Project could not be removed.");
                if (state.project === p.id) state.project = null;
                await loadProjects();
                renderPage();
              },
            );
          },
          "danger",
        ),
        button(
          "Start task",
          () => {
            state.project = p.id;
            state.folder = p.folders?.[0]?.path || "";
            d.close();
            navigate("new");
          },
          "primary",
        ),
      ),
    ]);
  }
  async function loadArtifacts() {
    try {
      state.artifacts = (await rpc("CoworkArtifacts", "getAllArtifacts")) || [];
      if (state.page === "artifacts") renderPage();
    } catch (e) {
      toast(e.message, true);
    }
  }
  function artifactThumbnail(artifact) {
    const preview = button(
      "",
      () => openArtifact(artifact.id),
      "artifact-thumbnail",
    );
    preview.setAttribute(
      "aria-label",
      "Preview " + (artifact.name || artifact.title || "artifact"),
    );
    if (artifact.html) {
      // Gallery tiles are inert and offline. Only the explicit preview runs scripts.
      const frame = el("iframe", {
        sandbox: "",
        referrerpolicy: "no-referrer",
        loading: "lazy",
        tabindex: -1,
        "aria-hidden": "true",
        title: "Artifact thumbnail",
      });
      frame.srcdoc =
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'">` +
        artifact.html;
      preview.append(frame);
    } else preview.append(icon("artifacts", 36));
    return preview;
  }
  async function openArtifact(id) { return workspaceUI.openArtifact(id); }
  async function loadSchedules() {
    try {
      state.schedules =
        (await rpc("CoworkScheduledTasks", "getAllScheduledTasks")) || [];
      if (state.page === "schedules") renderPage();
    } catch (e) {
      toast(e.message, true);
    }
  }
  // What is actually running on this machine, asked rather than assumed: systemd unit state plus a
  // connect to the port it would be listening on.
  // Tasks: numbered from zero, the same shape as the list the agent keeps while it works. The
  // number is the point — "task 3" is unambiguous between two people looking at the same screen,
  // and a list that renumbers itself on every status change is not a list anybody can point at.
  // Status is a button, not a checkbox: it cycles, so a row can go back without a second control.
  // The task list as a thing you can see while you work, not a page you navigate to. Numbered
  // from zero like the agent's own list, one line per task, status cycles on click. It sits in the
  // conversation surface because that is where the work is, and a list you have to leave the work
  // to look at is a list you stop looking at.
  function tasksWidget() {
    const rows = el("div", { class: "task-widget-rows" });
    const input = el("input", {
      class: "task-widget-input",
      placeholder: "Add a task…",
      spellcheck: false,
    });
    const ORDER = ["pending", "in_progress", "completed", "cancelled"];
    const LABEL = { pending: "pending", in_progress: "in progress", completed: "done", cancelled: "cancelled" };

    let section = null;
    let liveHeight = null;   // set by a drag in this session; survives the empty/!empty switch
    // Empty means a header and nothing else. "No tasks yet." plus an input plus a header is three
    // lines of furniture around a list with nothing in it, when the + is already the invitation.
    let editing = false;
    const draw = (tasks) => {
      const list = tasks || [];
      rows.replaceChildren();
      section.classList.toggle("is-empty", list.length === 0);
      if (!list.length) {
        editing = false;
        input.hidden = true;
        // One row is the RESTING state, not a rule: a height somebody dragged to is theirs and
        // stays theirs, empty or not. Only the default is small.
        // One row is the resting state. A height dragged a moment ago is honoured; one remembered
        // from a previous session is not, because an empty list should not come back tall.
        section.style.height = liveHeight || "";
        return;
      }
      const remembered = liveHeight || localStorage.getItem("quixi.tasksHeight");
      if (remembered) section.style.height = remembered;
      list.forEach((task, index) => {
        const status = task.status || "pending";
        rows.append(
          el(
            "div",
            { class: "task-widget-row" },
            el("span", { class: "task-widget-index" }, String(index)),
            el("span", { class: "task-widget-text" + (status === "completed" ? " is-done" : "") }, task.text || ""),
            el(
              "button",
              {
                class: "task-widget-status " + status,
                title: "Click to move it on",
                onclick: async () => {
                  const next = ORDER[(ORDER.indexOf(status) + 1) % ORDER.length];
                  const res = await api("/api/quixi/tasks/update", { id: task.id, status: next }).catch(() => null);
                  if (res && res.tasks) draw(res.tasks);
                },
              },
              LABEL[status] || status,
            ),
          ),
        );
      });
    };

    const add = async () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const res = await api("/api/quixi/tasks", { text }).catch(() => null);
      if (res && res.tasks) { input.value = ""; editing = false; input.hidden = true; draw(res.tasks); }
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); add(); }
    });

    api("/api/quixi/tasks").then((res) => draw(res && res.tasks)).catch(() => draw([]));

    // Resize from the TOP edge as well as the corner. A corner handle that nobody notices is not a
    // resizable panel, it is a resizable panel for people who already knew; dragging the top edge is
    // the gesture most people try first, and it is the one this now answers.
    section = el(
      "section",
      { class: "task-widget is-empty", "aria-label": "Tasks" },
      el("div", { class: "task-widget-head" },
        el("span", {}, "Tasks"),
        el("button", {
          class: "task-widget-add",
          title: "Add a task",
          onclick: () => {
            editing = true;
            input.hidden = false;
            input.focus();
          },
        }, "+")),
      rows,
      input,
    );
    input.hidden = true;
    const remembered = localStorage.getItem("quixi.tasksHeight");
    if (remembered) section.style.height = remembered;
    return section;
  }

  async function tasksPage(host) {
    const rows = el("div", { class: "task-rows" });
    const input = el("input", {
      class: "first-run-key",
      placeholder: "What needs doing?",
      spellcheck: false,
    });
    const ORDER = ["pending", "in_progress", "completed", "cancelled"];
    const LABEL = { pending: "pending", in_progress: "in progress", completed: "done", cancelled: "cancelled" };

    const draw = (tasks) => {
      rows.replaceChildren();
      const list = tasks || [];
      if (!list.length) {
        rows.append(el("p", { class: "muted" }, "Nothing on the list. A task is one sentence."));
        return;
      }
      list.forEach((task, index) => {
        const status = task.status || "pending";
        const pill = el(
          "button",
          {
            class: "task-status " + status,
            title: "Click to move it on",
            onclick: async () => {
              const next = ORDER[(ORDER.indexOf(status) + 1) % ORDER.length];
              const res = await api("/api/quixi/tasks/update", { id: task.id, status: next }).catch(() => null);
              if (res && res.tasks) draw(res.tasks);
            },
          },
          LABEL[status] || status,
        );
        rows.append(
          el(
            "div",
            { class: "task-row" + (status === "completed" ? " is-done" : "") },
            el("span", { class: "task-index" }, String(index)),
            el("span", { class: "task-text" }, task.text || ""),
            pill,
          ),
        );
      });
    };

    const add = async () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const res = await api("/api/quixi/tasks", { text }).catch(() => null);
      if (res && res.tasks) { input.value = ""; draw(res.tasks); }
      else toast("Could not add that task.", true);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); add(); }
    });

    host.replaceChildren(
      header(
        "Tasks",
        "The list the agent and I both work from. Numbered so either of us can say which one.",
        button("Add", add, "primary"),
      ),
      el("p", { class: "muted" }, "A task is a sentence and a status in tasks.json — nothing here is guessed from a conversation, and the file is yours to edit."),
      el("label", { class: "first-run-label" }, el("span", {}, "New task"), input),
      rows,
    );

    const first = await api("/api/quixi/tasks").catch(() => null);
    draw(first && first.tasks);
  }

  async function daemonsPage(host) {
    const body = el("div", { class: "daemon-list" }, el("p", { class: "muted" }, "Asking systemd and the loopback ports…"));
    host.replaceChildren(
      header("Daemons", "Background services this app leans on. Nothing here is required to start the app.", button("Check again", () => renderPage(), "quiet")),
      el("p", { class: "muted" }, "A daemon answers on a port or it does not. The state below is a live check, not a setting that says a service exists."),
      body,
    );
    let data = null;
    try { data = await api("/api/quixi/daemons"); } catch (e) { data = null; }
    if (!data || !data.daemons) {
      body.replaceChildren(el("p", { class: "error-text" }, "Could not read the daemon list."));
      return;
    }
    const act = async (d, action) => {
      if (!d.controllable) return toast(`${d.name} is not a service this app can control.`, true);
      if (action === "remove") {
        // The app's own dialog, not window.confirm: a native confirm blocks the webview's event loop,
        // which freezes the window behind a modal that the page cannot draw or dismiss.
        const ok = await new Promise((resolve) => {
          let answered = false;
          const dlg = dialog(
            `Remove ${d.name}?`,
            el(
              "div",
              { class: "browser-chooser" },
              el("p", {}, `That stops and disables ${d.unit}, and moves its unit file aside.`),
              el("p", { class: "muted" }, "It is not deleted — the file is renamed and can be put back."),
              el(
                "div",
                { class: "browser-chooser-list" },
                button("Remove it", () => { answered = true; dlg.close(); resolve(true); }, "primary"),
                button("Leave it alone", () => { answered = true; dlg.close(); resolve(false); }, "quiet"),
              ),
            ),
          );
          dlg.addEventListener("close", () => { if (!answered) resolve(false); });
        });
        if (!ok) return;
      }
      try {
        const res = await api("/api/quixi/daemons/action", { unit: d.unit, action });
        if (res && res.ok === false) throw new Error(res.error || "systemd refused");
        if (action === "remove" && res && res.unitFile) {
          toast(`${d.name} removed. The unit file is at ${res.unitFile}`);
        } else {
          toast(`${d.name}: ${action === "start" ? "starting" : "stopping"}…`);
        }
        await renderPage();
      } catch (e) {
        toast(String(e && e.message ? e.message : e), true);
      }
    };

    body.replaceChildren(
      ...data.daemons.map((d) =>
        el("div", { class: "daemon-row" + (d.up ? " up" : "") },
          el("button", {
            class: "daemon-dot" + (d.up ? " on" : ""),
            title: d.up ? `Stop ${d.name}` : `Start ${d.name}`,
            "aria-label": d.up ? `Stop ${d.name}` : `Start ${d.name}`,
            "aria-pressed": d.up ? "true" : "false",
            onclick: () => act(d, d.up ? "stop" : "start"),
          }),
          el("div", { class: "grow" },
            el("strong", {}, d.name),
            el("span", { class: "muted" }, " — " + d.what),
            el("div", { class: "daemon-meta" },
              el("code", {}, d.unit || "no unit"),
              d.port ? el("code", {}, ":" + d.port) : null,
              el("span", { class: "tag" }, d.up ? "up" : "down"),
              el("span", { class: "muted small" }, d.state || ""))),
          d.controllable
            ? el("div", { class: "daemon-actions" },
                button(d.up ? "Stop" : "Start", () => act(d, d.up ? "stop" : "start"), "quiet"),
                button("Remove", () => act(d, "remove"), "quiet danger"))
            : null,
        )),
      el("p", { class: "muted small daemon-note" },
        "Which services appear here comes from daemons.json in the app's data directory — name, unit and port. This page shows what is running; it does not write units."),
    );
  }
  function schedulesPage(host) {
    host.replaceChildren(
      header(
        "Cron jobs",
        "A prompt that runs on a clock. Five-field cron expression, this computer's time zone.",
        button("New cron job", () => scheduleEditor(), "primary", "plus"),
      ),
      el(
        "div",
        { class: "notice" },
        "These run only while QuixiDesk is open. A time that passes with the app closed is skipped, not caught up. Manual-mode tools still ask before they act.",
      ),
      el(
        "div",
        { class: "cron-legend" },
        el("code", {}, "minute hour day-of-month month day-of-week"),
        el("span", {}, "e.g. "),
        el("code", {}, "0 9 * * 1-5"),
        el("span", {}, "= 09:00, Monday to Friday"),
      ),
    );
    const list = el("div", { class: "list" });
    const active = state.schedules.filter((t) => t.status !== "deleted");
    if (!active.length) {
      host.append(
        el(
          "div",
          { class: "empty" },
          icon("schedule"),
          el("p", {}, "No cron jobs yet. A job is a prompt plus a schedule — \"every weekday at 09:00, summarise the repo\" is the whole idea."),
          button("Create the first one", () => scheduleEditor(), "primary"),
        ),
      );
    }
    for (const t of active)
      list.append(
        el(
          "div",
          { class: "list-row" },
          icon("schedule"),
          el(
            "div",
            { class: "grow" },
            el("h3", {}, t.displayName || t.name),
            el("p", {}, window.QuixiSchedules.describe(t)),
            el("code", { class: "cron-expression" }, t.cronExpression || t.cron || "not configured"),
            el("small", { class: "schedule-detail" }, window.QuixiSchedules.nextRunLabel(t)),
            el("small", { class: "schedule-detail" }, window.QuixiSchedules.runStatus(t)),
            t.lastRunMessage ? el("small", { class: "schedule-detail" }, t.lastRunMessage) : null,
          ),
          t.lastSessionId ? button("View last run", async()=>{await loadSessions();navigate("chat",t.lastSessionId);},"quiet") : null,
          button("Run now", async () => {
            try {
              const r = await rpc("CoworkScheduledTasks", "runScheduledTask", [t.id]);
              if (r.error) throw new Error(r.error);
              await loadSessions(); navigate("chat", r.sessionId);
            } catch (e) { toast(e.message, true); }
          }),
          button("Edit", () => scheduleEditor(t), "quiet"),
          button(
            t.enabled ? "Pause" : "Enable",
            async () => {
              try {
                const result = await rpc("CoworkScheduledTasks", "updateScheduledTaskStatus", [
                  t.id,
                  t.enabled ? "disabled" : "enabled",
                ]);
                if (result === false || result?.error) throw new Error(result?.error || "Schedule could not be updated. Check that its settings can be saved.");
                await loadSchedules();
              } catch (e) { toast(e.message, true); }
            },
            "quiet",
          ),
          button(
            "Delete",
            () =>
              confirmDialog(
                "Delete schedule?",
                `Remove “${t.displayName || t.name}”?`,
                async () => {
                  await rpc("CoworkScheduledTasks", "deleteScheduledTask", [
                    t.id,
                  ]);
                  await loadSchedules();
                },
              ),
            "danger",
          ),
        ),
      );
    host.append(
      list.children.length
        ? list
        : empty(
            "Keep a useful prompt handy",
            "Save a prompt and schedule definition for later use.",
          ),
    );
  }
  function scheduleEditor(t) { return window.QuixiSchedules.createEditor(workflowContext, t); }
  // Server-originated requests stay outside the transcript until the user acts.
  let mcpInteractionTimer = null, mcpInteractionLoading = false;
  let mcpInteractionRows = [], mcpInteractionDialog = null;
  const mcpInteractionBusy = new Set();
  function safeMcpUrl(value) {
    let url;
    try { url = new URL(value); } catch { throw new Error("The server supplied an invalid URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Only HTTP or HTTPS links without embedded credentials can be opened.");
    return url;
  }
  function interactionActive(item) { return item.status !== "completed" && Number(item.expiresAt || Infinity) > Date.now(); }
  async function pollMcpInteractions() {
    if (mcpInteractionLoading) return;
    mcpInteractionLoading = true;
    clearTimeout(mcpInteractionTimer);
    try {
      const result = await rpc("MCP", "pendingInteractions", [], "quixi.settings");
      if (result?.error) throw new Error(result.error);
      if (Array.isArray(result)) mcpInteractionRows = result;
      renderMcpInteractions();
      if (state.attachments.some(f => f.mcp?.subscribed)) await checkMcpResourceUpdates();
    } catch (error) {
      const notice = document.getElementById("mcp-interaction-status");
      if (notice) notice.textContent = "Could not refresh server requests. Retrying…";
    } finally {
      mcpInteractionLoading = false;
      mcpInteractionTimer = setTimeout(pollMcpInteractions, 1500);
    }
  }
  function renderMcpInteractions() {
    let tray = document.getElementById("mcp-interactions");
    const active = mcpInteractionRows.filter(interactionActive);
    const notices=mcpInteractionRows.filter(item=>interactionActive(item)||item.status==="completed");
    if (!tray && notices.length) {
      tray = el("aside", { id: "mcp-interactions", class: "mcp-interactions", "aria-label": "MCP server requests" }, el("p", {id:"mcp-interaction-status", role:"status", class:"hint"}));
      document.body.append(tray);
    }
    if (tray) {
      tray.querySelector("#mcp-interaction-status").textContent = "";
      const existing = new Map(Array.from(tray.querySelectorAll("[data-request]")).map(n => [n.dataset.request,n]));
      for (const request of notices) {
        let row = existing.get(request.id);
        if (!row) {
          row = el("section", { class: "mcp-interaction-notice", "data-request": request.id },
            el("strong", { class: "mcp-request-title" }), el("p", { class: "mcp-request-description" }),
            button("Review request", () => showMcpInteraction(request.id), "primary"));
          tray.append(row);
        }
        existing.delete(request.id);
        row.querySelector("strong").textContent = request.server;
        row.querySelector("button").hidden=request.status==="completed";
        row.querySelector("p").textContent = request.status === "completed" ? "External step completed. Retry your original action when ready." : request.status === "waiting_external" ? "Waiting for the external step to finish." : "Needs your response to continue.";
      }
      for (const row of existing.values()) row.remove();
      if (!notices.length) { tray.remove(); tray = null; }
    }
    if (mcpInteractionDialog) {
      const current = active.find(item => item.id === mcpInteractionDialog.id);
      if (!current) { mcpInteractionDialog.ended = true; mcpInteractionDialog.modal.close(); }
      else mcpInteractionDialog.update(current);
    }
  }
  function interactionFields(schema = {}) {
    const fields = el("div", { class: "mcp-interaction-fields" });
    const controls = [];
    for (const [name, definition] of Object.entries(schema.properties || {})) {
      const required = (schema.required || []).includes(name);
      const label = definition.title || name;
      const choices = definition.enum?.map(value=>({value,label:String(value)})) || definition.oneOf?.map(option=>({value:option.const,label:option.title||String(option.const)}));
      const multiChoices = definition.items?.enum?.map(value=>({value,label:String(value)})) || definition.items?.anyOf?.map(option=>({value:option.const,label:option.title||String(option.const)}));
      let input, read;
      if (definition.type === "boolean") {
        input = el("input", { type: "checkbox", checked: definition.default === true });
        read = () => input.checked;
        fields.append(el("label", { class: "mcp-checkbox" }, input, label));
      } else if (definition.type === "array" && Array.isArray(multiChoices)) {
        const options = multiChoices.map(({value,label}) => ({value,label,control:el("input",{type:"checkbox",checked:definition.default?.includes(value)})}));
        input = el("fieldset", {}, el("legend", {}, label + (required ? " (required)" : "")), options.map(({label,control})=>el("label",{class:"mcp-checkbox"},control,label)));
        read = () => options.filter(option=>option.control.checked).map(option=>option.value);
        fields.append(input);
      } else if (Array.isArray(choices)) {
        const selected = choices.findIndex(option=>option.value===definition.default);
        input = select([["", "Choose…"], ...choices.map((option,index)=>[String(index),option.label])], selected>=0?String(selected):"", null, {required});
        read = () => input.value === "" ? undefined : choices[Number(input.value)].value;
        fields.append(field(label + (required?" (required)":""),input,definition.description));
      } else if (["number", "integer"].includes(definition.type)) {
        input = el("input", { type: "number", step: definition.type === "integer" ? "1" : "any", min: definition.minimum, max: definition.maximum, required, value: definition.default ?? "" });
        read = () => input.value === "" ? undefined : Number(input.value);
        fields.append(field(label + (required?" (required)":""),input,definition.description));
      } else if (definition.type === "string") {
        input = el("input", {type:"text",required,value:definition.default || "",minlength:definition.minLength,maxlength:definition.maxLength,autocomplete:"off"});
        read = () => input.value === "" && !required ? undefined : input.value;
        fields.append(field(label + (required?" (required)":""),input,definition.description));
      } else { throw new Error(`Unsupported form field “${name}”. Decline the request and contact the server owner.`); }
      controls.push({name,definition,input,read,required});
    }
    return {fields, read: () => {
      const values = Object.create(null);
      for (const {name,definition,input,read,required} of controls) {
        const value=read();
        if (input.checkValidity && !input.checkValidity()) throw new Error(`Check the value for ${definition.title||name}.`);
        if (required && (value===undefined || value==="" || (Array.isArray(value)&&!value.length))) throw new Error(`${definition.title||name} is required.`);
        if (typeof value==="number" && (!Number.isFinite(value)||(definition.type==="integer"&&!Number.isInteger(value)))) throw new Error(`${name} must be a valid ${definition.type}.`);
        if (value!==undefined) values[name]=value;
      }
      return values;
    }};
  }
  function showMcpInteraction(id) {
    const request = mcpInteractionRows.find(item => item.id === id && interactionActive(item));
    if (!request) { toast("This server request has ended."); return; }
    if (mcpInteractionDialog?.id === id) { mcpInteractionDialog.modal.focus(); return; }
    if (mcpInteractionDialog) { mcpInteractionDialog.modal.focus(); toast("Finish the open server request first."); return; }
    const error = el("p", {class:"error-text",role:"alert"});
    const status = el("p", {class:"hint",role:"status"});
    let form = null, offeredUrl = null;
    const body = [el("p",{class:"mcp-request-message"},request.message || "The server needs your response.")];
    try {
      if (request.mode === "url") {
        offeredUrl=safeMcpUrl(request.url);
        body.push(el("div",{class:"mcp-external-destination"},el("strong",{},offeredUrl.host),el("p",{class:"path"},offeredUrl.href)),el("p",{class:"hint"},"Opening this page lets this server continue an external interaction. Check the destination before proceeding."));
      } else { form=interactionFields(request.requestedSchema);body.push(form.fields); }
    } catch (problem) { error.textContent=problem.message; }
    const invalidRequest=!!error.textContent;
    const view={id,modal:null,ended:false,answered:false,update:current=>{
      const waiting=current.status==="waiting_external";
      status.textContent=waiting?"Waiting for the server to confirm the external step. You can dismiss this notice; doing so does not cancel the external action.":`Expires ${new Date(current.expiresAt).toLocaleTimeString()}`;
      accept.hidden=waiting;decline.hidden=waiting;cancel.textContent=waiting?"Dismiss request":"Cancel";
    }};
    async function respond(action) {
      if (mcpInteractionBusy.has(id)) return;
      const current=mcpInteractionRows.find(item=>item.id===id&&interactionActive(item));
      if (!current) { error.textContent="This request has ended. No response was sent.";return; }
      try {
        const content=action==="accept" && form?form.read():null;
        if (action==="accept" && !form && !offeredUrl) throw new Error("This request cannot be accepted.");
        mcpInteractionBusy.add(id);view.modal.querySelectorAll("button").forEach(b=>b.disabled=true);error.textContent="";
        const result=await rpc("MCP","respondInteraction",[id,action,content],"quixi.settings");
        if (result?.error || result?.ok!==true) throw new Error(result?.error || "The server did not accept this response.");
        view.answered=true;
        if (action==="accept"&&offeredUrl) {
          const accepted=safeMcpUrl(result.url);
          if (accepted.href!==offeredUrl.href) throw new Error("The server destination changed. Review a new request before opening it.");
          await openExternal(accepted.href);
        }
        view.modal.close();await pollMcpInteractions();
      } catch(problem) {error.textContent=problem.message;if(view.answered){accept.hidden=true;decline.hidden=true;}} finally {mcpInteractionBusy.delete(id);view.modal?.querySelectorAll("button").forEach(b=>b.disabled=false);accept.disabled=invalidRequest;}
    }
    const accept=button(request.mode==="url"?"Open external page":"Send response",()=>respond("accept"),"primary");
    accept.disabled=!!error.textContent;
    const decline=button("Decline",()=>respond("decline"),"quiet");
    const cancel=button("Cancel",()=>respond("cancel"),"quiet");
    body.push(status,error,el("div",{class:"dialog-actions"},cancel,decline,accept));
    const modal=dialog(`Request from ${request.server}`,body);
    modal.classList.add("mcp-interaction-dialog");view.modal=modal;mcpInteractionDialog=view;view.update(request);
    modal.addEventListener("cancel",event=>{if(mcpInteractionBusy.has(id))event.preventDefault();});
    modal.addEventListener("click",event=>{if(event.target===modal&&mcpInteractionBusy.has(id))event.stopImmediatePropagation();},true);
    modal.addEventListener("close",()=>{
      if(mcpInteractionDialog===view)mcpInteractionDialog=null;
      if(!view.ended&&!view.answered&&!mcpInteractionBusy.has(id)&&request.status!=="waiting_external")mcpRequest("respondInteraction",[id,"cancel",null]).then(result=>{if(result?.ok!==true)throw new Error("The server did not confirm cancellation.");return pollMcpInteractions();}).catch(error=>{toast(error.message,true);pollMcpInteractions();});
    });
  }
  async function mcpRequest(member,args=[]) {
    const result=await rpc("MCP",member,args,"quixi.settings");
    if(result?.error)throw new Error(typeof result.error==="string"?result.error:result.error.message);
    return result;
  }
  async function toggleMcpTool(server,tool,enabled) {
    const result=await mcpRequest("setToolEnabled",[server,tool,enabled]);
    if(result?.ok!==true)throw new Error("The tool setting could not be saved.");
    await loadTools({poll:true});
  }
  function mcpText(result,kind) {
    const parts=[];
    const blocks=kind==="prompt"?(result.messages||[]).map(message=>({role:message.role,...message.content})):result.contents||[];
    for(const block of blocks){if(typeof block.text==="string")parts.push(`${block.role?block.role+": ":""}${block.text}`);}
    if(!parts.length)throw new Error("This item has no text content to attach. Binary resources are not supported as text attachments.");
    const text=parts.join("\n\n");
    if(text.includes("\u0000")||new TextEncoder().encode(text).length>1000000)throw new Error("This item exceeds the 1 MB text attachment limit or contains binary data.");
    return text;
  }
  function attachMcpContext(item) {
    const key=draftKey();
    const attachment={id:crypto.randomUUID(),name:item.name,text:item.text,mcp:{server:item.server,uri:item.uri,cwd:item.cwd,subscribed:false,version:item.version||0,kind:item.kind}};
    state.attachments.push(attachment);saveDraft();renderChips();
    toast(`Added ${item.name} to ${key==="new"?"the new task":"this task"}. It is sent only when you send your message.`);
  }
  async function previewMcpContext(server,item,kind,args={},onAttach=()=>{},isCurrent=()=>true) {
    const cwd=currentFolder(), origin=draftKey();
    let uri=item.uri;
    if(kind==="template") {const expanded=await mcpRequest("expandResourceTemplate",[server,item.uriTemplate,args,cwd]);uri=expanded?.uri;if(!uri)throw new Error("The resource template did not produce a URI.");}
    const result=kind==="prompt"?await mcpRequest("getPrompt",[server,item.name,args,cwd]):await mcpRequest("readResource",[server,uri,cwd]);
    if(!isCurrent())return;
    if(draftKey()!==origin)throw new Error("The active conversation changed. Open the context picker again.");
    const text=mcpText(result,kind);
    const name=item.title||item.name||uri;
    const preview=dialog(name,[el("p",{class:"hint"},`${server}${uri?" · "+uri:" · Prompt"}`),el("pre",{class:"code-preview mcp-context-preview"},text),el("p",{class:"hint"},"Review this server's content before adding it. It will become context for your next message."),el("div",{class:"dialog-actions"},button("Add to message",()=>{if(!isCurrent())throw new Error("This context picker was closed. Open it again to add context.");if(draftKey()!==origin)throw new Error("The active conversation changed. Open this context again for the current conversation.");attachMcpContext({name:`${server}: ${name}`,server,uri,cwd,text:`Source: ${server}${uri?" ("+uri+")":""}\n\n${text}`,kind:kind==="prompt"?"prompt":"resource"});preview.close();onAttach();},"primary"))],{wide:true});
  }
  async function mcpContextPicker(initialServer=null) {
    const list=await rpc("LocalAgentModeSessions","getLocalMcpServers");
    if(!Array.isArray(list))throw new Error("MCP servers could not be loaded.");
    const servers=list.filter(s=>!s.builtin);
    const options=[["","Choose a server"],...servers.map(s=>[s.name,s.name])];
    const selector=select(options,initialServer||"",()=>load(),{"aria-label":"MCP context server"});
    const search=el("input",{type:"search",placeholder:"Search resources and prompts","aria-label":"Search MCP context"});
    const status=el("p",{class:"hint",role:"status"}),error=el("p",{class:"error-text",role:"alert"}),results=el("div",{class:"mcp-context-results"});
    const refresh=button("Refresh",()=>load(),"quiet");
    let catalog=null,generation=0,closed=false,contextLimit=50;
    function render(){
      results.replaceChildren();if(!catalog)return;
      const query=search.value.trim().toLowerCase();
      for(const [label,kind,items] of [["Resources","resource",catalog.resources],["Resource templates","template",catalog.resourceTemplates],["Prompts","prompt",catalog.prompts]]){
        const matches=(items||[]).filter(item=>`${item.name||""} ${item.title||""} ${item.description||""} ${item.uri||item.uriTemplate||""}`.toLowerCase().includes(query));
        if(!matches.length)continue;
        results.append(el("h3",{},label));
        for(const item of matches.slice(0,contextLimit)){
          const title=item.title||item.name||item.uri||item.uriTemplate, server=selector.value;
          results.append(el("article",{class:"mcp-context-item"},el("div",{class:"grow"},el("strong",{},title),item.description?el("p",{class:"muted"},item.description):null),button("Preview",async()=>{
            const fields=kind==="prompt"?(item.arguments||[]).map(arg=>({name:arg.name,label:arg.title||arg.name,required:arg.required,hint:arg.description})):kind==="template"?Array.from(new Set(Array.from(item.uriTemplate.matchAll(/\{([^}]+)\}/g)).flatMap(match=>match[1].replace(/^[+#./;?&]/,"").split(",").map(v=>v.replace(/[:*].*$/,""))))).map(name=>({name,label:name,required:true})):[];
            if(fields.length)formDialog(title,fields,args=>previewMcpContext(server,item,kind,args,()=>modal.close(),()=>!closed),{submit:"Preview"});
            else await previewMcpContext(server,item,kind,{},()=>modal.close(),()=>!closed);
          },"quiet")));
        }
        if(matches.length>contextLimit)results.append(button(`Show more ${label.toLowerCase()} (${matches.length-contextLimit} remaining)`,()=>{contextLimit+=50;render();},"quiet"));
      }
      if(!results.childElementCount)results.append(el("p",{class:"muted"},query?"No context matches this search.":"This server has no resources, templates, or prompts."));
    }
    async function load(){
      const mine=++generation;catalog=null;contextLimit=50;results.replaceChildren();error.textContent="";
      if(!selector.value){status.textContent=servers.length?"Choose a server to browse its context.":"Configure an MCP server in Tools & skills to add external context.";return;}
      status.textContent="Loading resources and prompts…";refresh.disabled=true;
      try {const result=await mcpRequest("browseResources",[selector.value,currentFolder()]);if(mine!==generation||closed)return;catalog=result;status.textContent="Choose an item to preview before adding it to your message.";render();}
      catch(problem){if(mine===generation&&!closed){error.textContent=problem.message;status.textContent="Context is unavailable. Fix the connection and retry.";}}
      finally{if(mine===generation)refresh.disabled=false;}
    }
    search.addEventListener("input",()=>{contextLimit=50;render();});
    const modal=dialog("Add MCP context",[field("Server",selector),el("div",{class:"mcp-context-toolbar"},search,refresh),status,error,results],{wide:true});
    modal.addEventListener("close",()=>{closed=true;generation++;});
    await load();
  }
  async function checkMcpResourceUpdates(){
    const updates=await mcpRequest("resourceUpdates");if(!Array.isArray(updates))return;
    let changed=false;
    for(const file of state.attachments){if(!file.mcp?.subscribed)continue;const update=updates.find(u=>u.server===file.mcp.server&&u.uri===file.mcp.uri&&(!u.cwd||u.cwd===file.mcp.cwd));
      if(update&&Number(update.version||update.updatedAt||0)>Number(file.mcp.version||0)){file.mcp.availableVersion=Number(update.version||update.updatedAt);file.mcp.stale=true;changed=true;}}
    if(changed){renderChips();saveDraft();}
  }
  async function followMcpResource(file,enabled){
    const result=await mcpRequest("subscribeResource",[file.mcp.server,file.mcp.uri,file.mcp.cwd,enabled]);
    if(result?.ok!==true)throw new Error("Resource subscription was not accepted.");file.mcp.subscribed=enabled;saveDraft();renderChips();
  }
  async function refreshMcpAttachment(file){
    const version=file.mcp.availableVersion||file.mcp.version;
    const result=await mcpRequest("readResource",[file.mcp.server,file.mcp.uri,file.mcp.cwd]);
    const text=mcpText(result,"resource");
    const preview=dialog("Review updated context",[el("p",{class:"hint"},`${file.mcp.server} · ${file.mcp.uri}`),el("pre",{class:"code-preview mcp-context-preview"},text),el("div",{class:"dialog-actions"},button("Use this version",()=>{file.text=`Source: ${file.mcp.server} (${file.mcp.uri})\n\n${text}`;file.mcp.version=version;file.mcp.stale=(file.mcp.availableVersion||0)>version;saveDraft();renderChips();preview.close();},"primary"))],{wide:true});
  }
  async function mcpRootsEditor(name){
    const cwd=currentFolder();
    const catalog=await mcpRequest("browseResources",[name,cwd]);
    const paths=(catalog.roots||[]).map(root=>root.path||(()=>{try{return decodeURIComponent(new URL(root.uri).pathname);}catch{return "";}})()).filter(Boolean);
    const list=el("div",{class:"mcp-root-list"}),error=el("p",{class:"error-text",role:"alert"});
    const render=()=>list.replaceChildren(...paths.map((path,index)=>el("div",{class:"row"},el("span",{class:"path grow"},path),button("Remove",()=>{paths.splice(index,1);render();},"quiet"))));
    render();
    const modal=dialog(`Folders shared with ${name}`,[el("p",{class:"hint"},"These folders are advertised to this server as workspace roots. Changing roots does not grant permission to execute tools."),list,button("Add folder",async()=>{const path=await rpc("FileSystem","browseFolder",["Choose a folder for this MCP server"]);const value=typeof path==="string"?path:path?.path;if(value&&!paths.includes(value)){paths.push(value);render();}},"quiet"),error,el("div",{class:"dialog-actions"},button("Save folders",async()=>{try{const result=await mcpRequest("setRoots",[name,cwd,paths]);if(result?.ok!==true)throw new Error("Folders could not be updated.");modal.close();await loadTools({poll:true});}catch(problem){error.textContent=problem.message;}},"primary"))]);
  }
  let toolsData = { skills: [], servers: [], error: "" };
  let toolsPollTimer = null;
  let toolsLoadInFlight = null;
  let mcpCatalogDialog = null;
  const mcpBusy = new Set();
  const mcpAuthUrls = new Map();
  const mcpAuthRequested = new Set();
  const mcpAuthOpened = new Set();
  const mcpStatusLabels = {
    configured: "Not connected", starting: "Starting", initializing: "Initializing",
    discovering: "Discovering tools", ready: "Ready", refreshing: "Refreshing tools",
    failed: "Failed", disconnected: "Disconnected", disabled: "Disabled", needs_auth: "Sign-in required", authenticating: "Waiting for sign-in",
  };
  const mcpPending = (status) => ["starting", "initializing", "discovering", "refreshing"].includes(status);
  const mcpError = (server) => typeof server.error === "string" ? server.error : server.error?.message || "";
  async function loadTools({ poll = false } = {}) {
    if (toolsLoadInFlight) return toolsLoadInFlight;
    clearTimeout(toolsPollTimer);
    toolsLoadInFlight = (async () => {
      try {
        const [skills, servers] = await Promise.all([
          poll ? Promise.resolve(toolsData.skills) : rpc("LocalAgentModeSessions", "listLocalSkills"),
          rpc("LocalAgentModeSessions", "getLocalMcpServers"),
        ]);
        if (!Array.isArray(servers)) throw new Error("MCP connection status is unavailable. Retry or check your configuration.");
        toolsData = { skills: Array.isArray(skills) ? skills : [], servers, error: "" };
        if (state.page === "tools") {
          if (poll) updateMcpConnections();
          else renderPage();
        }
        mcpCatalogDialog?.update();
      } catch (e) {
        toolsData.error = e.message;
        if (state.page === "tools") updateMcpConnections();
        if (!poll) toast(e.message, true);
      } finally {
        toolsLoadInFlight = null;
        if (state.page === "tools") toolsPollTimer = setTimeout(() => loadTools({ poll: true }), 2000);
      }
    })();
    return toolsLoadInFlight;
  }
  async function mcpAction(name, action) {
    if (mcpBusy.has(name)) return;
    mcpBusy.add(name);
    updateMcpConnections();
    try {
      const result = await rpc("MCP", action, [name, currentFolder()], "quixi.settings");
      if (result?.error) throw new Error(typeof result.error === "string" ? result.error : result.error.message);
      if (action === "authenticate") {
        if (result?.status !== "authenticating" && typeof result?.url !== "string") throw new Error("The server did not start sign-in.");
        mcpAuthRequested.add(name);
        if (typeof result?.url === "string") mcpAuthUrls.set(name, result.url);
        await loadTools({ poll: true });
      } else {
        if (result?.ok !== true) throw new Error("The connection action was not accepted.");
        if (["cancelAuthentication", "forgetAuthentication"].includes(action)) { mcpAuthUrls.delete(name); mcpAuthRequested.delete(name); }
        await loadTools({ poll: true });
      }
    } finally {
      mcpBusy.delete(name);
      updateMcpConnections();
    }
  }
  function mcpConnectionRow(server) {
    const row = el("article", { class: "mcp-connection", "data-server": server.name });
    const controls = el("div", { class: "mcp-controls" });
    for (const [action, label] of [["connect", "Connect"], ["reconnect", "Retry"], ["refresh", "Refresh tools"], ["disconnect", "Disconnect"], ["authenticate", "Sign in"], ["cancelAuthentication", "Cancel sign-in"]]) {
      const control = button(label, () => mcpAction(server.name, action), "quiet");
      control.dataset.mcpAction = action;
      control.setAttribute("aria-label", `${label} ${server.name}`);
      controls.append(control);
    }
    const forget = button("Forget sign-in", () => confirmDialog("Forget sign-in?", `Disconnect “${server.name}” and remove its saved sign-in credentials? You can sign in again later.`, () => mcpAction(server.name, "forgetAuthentication"), "Forget sign-in"), "quiet");
    forget.dataset.mcpAction = "forgetAuthentication";
    forget.setAttribute("aria-label", `Forget sign-in for ${server.name}`);
    controls.append(forget);
    const browser = button("Open sign-in page", () => openExternal(mcpAuthUrls.get(server.name)), "quiet");
    browser.dataset.mcpAction = "openAuth";
    browser.setAttribute("aria-label", `Open sign-in page for ${server.name}`);
    controls.append(browser);
    const catalog = button("View tools", () => showMcpCatalog(server.name), "quiet");
    catalog.dataset.mcpAction = "catalog";
    catalog.setAttribute("aria-label", `View tools for ${server.name}`);
    controls.append(catalog);
    const context=button("Browse context",()=>mcpContextPicker(server.name),"quiet");context.dataset.mcpAction="context";context.setAttribute("aria-label",`Browse context for ${server.name}`);controls.append(context);
    const roots=button("Workspace folders",()=>mcpRootsEditor(server.name),"quiet");roots.dataset.mcpAction="roots";roots.setAttribute("aria-label",`Workspace folders for ${server.name}`);controls.append(roots);
    row.append(
      el("div", { class: "mcp-heading" }, icon("tools"), el("h3", { class: "grow" }, server.name), el("span", { class: "tag mcp-state", role: "status" })),
      el("p", { class: "muted mcp-catalog-count" }),
      el("p", { class: "hint mcp-last-success" }),
      el("p", { class: "hint mcp-retry-status", role: "status" }),
      el("p", { class: "hint mcp-auth-hint", role: "status" }),
      el("p", { class: "error-text mcp-error", role: "alert" }), controls,
      el("details", { class: "mcp-diagnostics" }, el("summary", {}, "Connection details"), el("pre", { class: "mcp-diagnostics-content" })),
    );
    return row;
  }
  function updateMcpConnections() {
    const list = document.getElementById("mcp-connections");
    if (!list) return;
    const error = document.getElementById("mcp-load-error");
    if (error) { error.textContent = toolsData.error; error.hidden = !toolsData.error; }
    const current = new Map(Array.from(list.children).map((row) => [row.dataset.server, row]));
    for (const server of toolsData.servers) {
      let row = current.get(server.name);
      if (!row) { row = mcpConnectionRow(server); list.append(row); }
      current.delete(server.name);
      const status = server.status || "configured";
      if (["ready", "failed", "disabled", "disconnected", "needs_auth"].includes(status)) {
        mcpAuthUrls.delete(server.name); mcpAuthRequested.delete(server.name);
      }
      if (status === "authenticating" && typeof server.authorizationUrl === "string" && server.authorizationUrl) mcpAuthUrls.set(server.name, server.authorizationUrl);
      const authUrl = mcpAuthUrls.get(server.name);
      if (status === "authenticating" && authUrl && mcpAuthRequested.has(server.name)) {
        const attempt = `${server.name}:${server.authAttempt || authUrl}`;
        if (!mcpAuthOpened.has(attempt)) {
          mcpAuthOpened.add(attempt);
          openExternal(authUrl).catch(error => toast(error.message, true));
        }
      }
      row.dataset.status = status;
      row.querySelector(".mcp-state").textContent = mcpStatusLabels[status] || "Unavailable";
      const count = Array.isArray(server.tools) ? server.tools.length : 0;
      const stale = server.catalogStale || (server.toolsEnumerated && !server.isConnected);
      row.querySelector(".mcp-catalog-count").textContent = server.toolsEnumerated
        ? `${count} ${count === 1 ? "tool" : "tools"}${stale ? " in last-known catalog · connection not verified" : " discovered"}`
        : (mcpPending(status) ? "Waiting for server initialization and tool discovery." : "Tool discovery has not completed.");
      const authHint = row.querySelector(".mcp-auth-hint");
      authHint.textContent = status === "authenticating" ? (authUrl ? "Complete sign-in in your browser. This connection will update automatically." : "Preparing secure sign-in… Your browser will open when the server is ready.") : "";
      authHint.hidden = !authHint.textContent;
      const last = row.querySelector(".mcp-last-success");
      const timestamp = server.lastSuccessAt;
      const date = timestamp ? new Date(timestamp) : null;
      last.textContent = date && !Number.isNaN(date.getTime()) ? "Last discovery: " + date.toLocaleString() : "";
      last.hidden = !last.textContent;
      const retry=row.querySelector(".mcp-retry-status");
      retry.textContent=server.circuitOpen?"Automatic retries paused after repeated failures. Reconnect when ready.":Number(server.nextRetryAt)>Date.now()?`Retrying in ${Math.max(1,Math.ceil((server.nextRetryAt-Date.now())/1000))}s · attempt ${Math.min(3,Number(server.retryAttempt||0)+1)}`:"";
      retry.hidden=!retry.textContent;
      const problem = row.querySelector(".mcp-error");
      const rawError=mcpError(server);
      problem.textContent = status==="needs_auth" && /(?:auth(?:orization)? required|HTTP 401)/i.test(rawError) ? "This server requires sign-in before its tools can be used." : rawError;
      problem.hidden = !problem.textContent;
      const diagnostics = row.querySelector(".mcp-diagnostics-content");
      diagnostics.textContent = [
        server.builtin ? "Built into QuixiDesk" : (server.transport ? `Transport: ${server.transport}` : ""),
        server.cwd ? `Workspace: ${server.cwd}` : "",
        server.serverInfo?.name ? `Server: ${server.serverInfo.name}${server.serverInfo.version ? " " + server.serverInfo.version : ""}` : "",
        server.error?.kind ? `Failure: ${server.error.kind}` : "",
        rawError ? `Error: ${rawError}` : "",
        server.generation != null ? `Catalog generation: ${server.generation}` : "",
        server.stderr ? `Recent server output:\n${server.stderr}` : "",
      ].filter(Boolean).join("\n");
      row.querySelector(".mcp-diagnostics").hidden = !diagnostics.textContent;
      for (const control of row.querySelectorAll("[data-mcp-action]")) {
        const action = control.dataset.mcpAction;
        if(action==="reconnect"){control.textContent=server.circuitOpen?"Reconnect":"Retry";control.setAttribute("aria-label",`${server.circuitOpen?"Reconnect":"Retry"} ${server.name}`);}
        control.hidden = server.builtin && action !== "catalog" ? true
          : server.error?.kind === "configuration" && action !== "catalog" ? true
          : action === "context" ? status !== "ready"
          : action === "roots" ? status !== "ready"
          : action === "connect" ? server.circuitOpen || !["configured", "disconnected"].includes(status)
          : action === "reconnect" ? status !== "failed" && !server.circuitOpen
          : action === "authenticate" ? status !== "needs_auth"
          : action === "cancelAuthentication" ? status !== "authenticating"
          : action === "openAuth" ? status !== "authenticating" || !mcpAuthUrls.has(server.name)
          : action === "forgetAuthentication" ? !server.hasAuth
          : action === "refresh" ? status !== "ready"
          : action === "disconnect" ? !(server.isConnected || mcpPending(status))
          : false;
        control.disabled = mcpBusy.has(server.name) || (action === "catalog" && count === 0);
      }
    }
    for (const row of current.values()) row.remove();
    if (!toolsData.servers.length) list.append(el("p", { class: "muted", "data-server": "" }, "No MCP servers are configured."));
    capabilityUI?.enhanceConnections();
  }
  function showMcpCatalog(name) {
    const search = el("input", { type: "search", placeholder: "Search tool names and descriptions", "aria-label": `Search tools for ${name}` });
    const status = el("p", { class: "hint", role: "status" });
    const results = el("div", { class: "mcp-tool-results" });
    let limit = 50, signature = "";
    const rememberedOpen = new Set();
    const render = () => {
      const server = toolsData.servers.find((server) => server.name === name);
      if (!server) { status.textContent = "This connection was removed."; results.replaceChildren(); return; }
      for(const node of results.querySelectorAll("details")){if(node.open)rememberedOpen.add(node.dataset.tool);else rememberedOpen.delete(node.dataset.tool);}
      const open = rememberedOpen;
      const query = search.value.trim().toLowerCase();
      const tools = (server.tools || []).filter((tool) => `${tool.name} ${tool.description || ""}`.toLowerCase().includes(query));
      status.textContent = `${mcpStatusLabels[server.status] || "Not connected"} · ${tools.length} matching ${tools.length === 1 ? "tool" : "tools"}${server.catalogStale || !server.isConnected ? " · Last-known catalog; execution may be unavailable" : ""}`;
      results.replaceChildren();
      for (const tool of tools.slice(0, limit)) {
        results.append(el("details", { class: "mcp-tool", "data-tool": tool.name, open: open.has(tool.name) },
          el("summary", {}, tool.name), tool.description ? el("p", {}, tool.description) : null,
          !server.builtin ? el("div",{class:"mcp-tool-policy"},el("label",{class:"mcp-checkbox"},el("input",{type:"checkbox",checked:tool.enabled!==false,"aria-label":`Enable ${tool.name} on ${name}`,onChange:async event=>{const control=event.target;control.disabled=true;try{await toggleMcpTool(name,tool.name,control.checked);}catch(problem){control.checked=!control.checked;toast(problem.message,true);}finally{control.disabled=false;}}}),"Enabled"),el("span",{class:"hint"},tool.enabled===false?"Disabled · unavailable to the model":tool.modelVisible===false||(Array.isArray(tool._meta?.ui?.visibility)&&tool._meta.ui.visibility.every(value=>value!=="model"))?"App only · hidden from the model":"Available to the model")) : null,
          el("pre", { class: "mcp-schema" }, JSON.stringify(tool, null, 2))));
      }
      if (!tools.length) results.append(el("p", { class: "muted" }, "No tools match this search."));
      if (tools.length > limit) results.append(button(`Show more (${tools.length - limit} remaining)`, () => { limit += 50; render(); }, "quiet"));
    };
    search.addEventListener("input", () => { limit = 50; render(); });
    const modal = dialog(`${name} tools`, [search, status, results], { wide: true });
    const view = { update: () => {
      const server = toolsData.servers.find((s) => s.name === name);
      const next = JSON.stringify(server);
      if (next !== signature) { signature = next; render(); }
    } };
    mcpCatalogDialog = view;
    modal.addEventListener("close", () => { if (mcpCatalogDialog === view) mcpCatalogDialog = null; });
    view.update();
  }
  async function mcpEditor() {
    const config = await rpc(
      "MCP",
      "getMcpServersConfig",
      [],
      "quixi.settings",
    );
    if (config?.error) throw new Error(typeof config.error === "string" ? config.error : config.error.message);
    formDialog(
      "MCP configuration",
      [
        {
          name: "json",
          label: "Server configuration (JSON)",
          value: JSON.stringify({ mcpServers: config }, null, 2),
          multiline: true,
          attrs: { rows: 15 },
          hint: "Use command/args/env for local servers, or transport: http (or sse), url and optional headers for remote servers. External commands run with your account permissions.",
        },
      ],
      async (values) => {
        const parsed = JSON.parse(values.json);
        if (
          !parsed.mcpServers ||
          typeof parsed.mcpServers !== "object" ||
          Array.isArray(parsed.mcpServers)
        )
          throw new Error("Provide a mcpServers object.");
        // The host validates changed entries independently, preserving an existing
        // invalid entry while the user repairs another connection.
        const result = await rpc("MCP", "setMcpServerConfigs", [parsed.mcpServers], "quixi.settings");
        if (result?.error) throw new Error(typeof result.error === "string" ? result.error : result.error.message);
        if (result?.ok !== true) throw new Error("MCP configuration could not be saved.");
        await loadTools();
        // The server list just changed, so the composer's context button has to re-decide whether
        // it belongs in the row.
        mcpContextServers = -1;
      },
      { wide: true },
    );
  }
  // The persona page: what is loaded, where the file lives, and an editor that writes it.
  // The palace as a working folder. Read from the engine, never reconstructed from a preference that
  // may not have been set — the default lives in one place and this asks it.
  let palaceFolderCache = null;
  async function palaceFolder() {
    if (palaceFolderCache) return palaceFolderCache;
    let info = null;
    try { info = await rpc("Memory", "info"); } catch {}
    const path = (info && (info.path || info.defaultPath)) || "";
    // The workspace is the palace's PARENT, not the palace itself. A workspace of
    // Documents/memory-palace makes every ordinary file question — "what is in my Documents" —
    // an access-outside-the-workspace request, which is a permission prompt for something the
    // person already considers theirs. Documents holds the palace and the rest of their files.
    const parent = path && path.lastIndexOf("/") > 0 ? path.slice(0, path.lastIndexOf("/")) : path;
    palaceFolderCache = { path: parent, palace: path, dataDir: (info && info.dataDir) || "" };
    return palaceFolderCache;
  }

  function personasFolder() {
    const file = (state.persona && state.persona.path) || "~/.quixi/persona.md";
    const cut = file.lastIndexOf("/");
    return cut > 0 ? `${file.slice(0, cut)}/personas` : "~/.quixi/personas";
  }

  // Personas, as a settings section rather than a chip in the header.
  //
  // Everything the chip did lives here now, plus the part the chip could never do: showing what the
  // persona actually says. A persona is a markdown file on somebody's disk — the point of it being a
  // file is that it can be read, so the section reads it out instead of describing where it is.
  async function personaSettings(host) {
    await loadPersona();
    const p = state.persona || {};
    const shelf = await rpc("AppPreferences", "listPersonas").catch(() => null);
    const shelfRows = (shelf && shelf.personas) || [];
    const others = shelfRows.filter((x) => x.name !== p.name || x.slug !== (p.slug || ""));

    const reader = el("pre", { class: "persona-read" }, (p.content || "").trim() || "(this persona file is empty)");
    reader.hidden = true;
    const toggle = button("Read it here", () => {
      const open = reader.hidden;
      reader.hidden = !open;
      toggle.textContent = open ? "Hide the text" : "Read it here";
    }, "reveal");

    host.append(
      el("h2", {}, "Who is speaking"),
      el(
        "div",
        { class: "persona-status" },
        el("strong", {}, p.loaded ? p.name : "No persona loaded"),
        el("span", { class: "tag" }, p.loaded ? "LIVE" : "EMPTY"),
        el("span", { class: "muted" }, `${p.bytes || 0} bytes`),
      ),
      el(
        "p",
        { class: "muted" },
        "A persona is a markdown file read at the start of every turn, so an edit takes effect on the next message. The first line beginning with '# ' is the name shown here. It is an ordinary file: you can open it, copy it, back it up or put it in git.",
      ),
      el("label", { class: "settings-field" }, el("span", {}, "Persona file"), el("code", { class: "persona-path" }, p.path || "~/.quixi/persona.md")),
      el(
        "label",
        { class: "settings-field" },
        el("span", {}, "Personas folder"),
        el("code", { class: "persona-path" }, personasFolder()),
      ),
      el(
        "div",
        { class: "toolbar" },
        button("Edit the persona file", () => navigate("persona"), "primary"),
        button("Save this one to the shelf…", () => savePersonaAsFlow(), "reveal"),
        button("Open the personas folder", () => rpc("AppPreferences", "revealPersonas"), "quiet"),
        button("Use the shipped persona", () => restorePersonaFlow(), "quiet"),
      ),
      el("h2", { style: "margin-top:30px" }, "What it says"),
      el(
        "p",
        { class: "muted" },
        "The text this build ships with, read straight from the file that is loaded right now. Nothing is summarised: if you want to know what the assistant was told to be, this is the whole of it.",
      ),
      el("div", { class: "toolbar" }, toggle),
      reader,
      el("h2", { style: "margin-top:30px" }, "The shelf"),
      el(
        "p",
        { class: "muted" },
        shelfRows.length
          ? "Copies you have saved. Switching one changes who is speaking immediately; deleting one asks you to type its name first."
          : "Empty. Saving the current persona puts a copy in the folder so you can switch back to it later.",
      ),
      el(
        "div",
        { class: "persona-shelf" },
        ...shelfRows.map((x) =>
          el(
            "div",
            { class: "persona-shelf-row" },
            el("span", { class: "persona-shelf-name" }, x.name),
            el("span", { class: "muted" }, `${x.slug} · ${x.bytes} B`),
            x.slug === (p.slug || "") ? el("span", { class: "tag" }, "CURRENT") : null,
            el("span", { class: "spacer" }),
            x.slug === (p.slug || "")
              ? null
              : button("Switch to it", () => activatePersonaFlow(x.slug, x.name), "reveal"),
            button("Delete…", () => deletePersonaFromShelf(x.slug, x.name), "quiet"),
          ),
        ),
      ),
    );
  }

  async function personaPage(host) {
    await loadPersona();
    const p = state.persona || {};
    const bytes = el("span", { class: "muted" }, `${p.bytes || 0} bytes`);
    const editor = el("textarea", {
      class: "persona-editor",
      spellcheck: "false",
      rows: 22,
      placeholder: "Write the persona: who is speaking, how they talk, what they will not do.",
    });
    editor.value = p.content || "";
    const save = button("Save persona", async () => {
      const res = await rpc("AppPreferences", "setPersona", [{ content: editor.value }]).catch((e) => ({ ok: false, error: String(e) }));
      if (res && res.ok) {
        toast(`Persona saved: ${res.name || "unnamed"}`);
        await loadPersona();
        renderPage();
      } else {
        toast(`Could not save: ${(res && res.error) || "unknown error"}`, true);
      }
    }, "primary");
    // The build ships a persona. Putting it back is an explicit act with a confirmation, because it
    // is the only control here that discards a file the user may have written themselves.
    const restore = button("Use the shipped persona", async () => {
      const current = (state.persona && state.persona.bytes) || 0;
      const ok = current === 0 || window.confirm(
        `Replace ${(state.persona && state.persona.path) || "the persona file"} (${current} bytes) with the one this build ships?`,
      );
      if (!ok) return;
      const res = await rpc("AppPreferences", "restoreShippedPersona", []).catch((e) => ({ ok: false, error: String(e) }));
      if (res && res.ok) {
        toast(`Persona restored: ${res.name || "unnamed"}`);
        await loadPersona();
        renderPage();
      } else {
        toast(`Could not restore: ${(res && res.error) || "unknown error"}`, true);
      }
    }, "quiet");
    host.replaceChildren(
      el(
        "section",
        { class: "persona-page" },
        header("Persona", "Who is answering. A file on this machine, not a setting in a browser."),
        el(
          "div",
          { class: "persona-status" },
          el("strong", {}, p.loaded ? p.name : "No persona loaded"),
          el("span", { class: "tag" }, p.loaded ? "LIVE" : "EMPTY"),
          bytes,
          el("code", { class: "persona-path" }, p.path || "~/.quixi/persona.md"),
        ),
        el(
          "p",
          { class: "muted" },
          "The file is read at the start of every turn, so an edit takes effect on the next message. The first line beginning with '# ' is the name shown here.",
        ),
        editor,
        el("div", { class: "toolbar" }, save, restore),
      ),
    );
  }

  // Reads the real paths from the engine and renders them. Nothing here is guessed in the webview.
  async function drawStorageLocations() {
    const host = document.getElementById("storage-locations");
    if (!host) return;
    let data = null;
    try { data = await api("/api/quixi/storage/locations"); } catch (e) { data = null; }
    if (!data || !data.data_dir) {
      host.replaceChildren(el("p", { class: "error-text" }, "Could not read the data directory."));
      return;
    }
    host.replaceChildren(
      el("div", { class: "storage-head" },
        el("code", { class: "storage-path" }, data.data_dir),
        el("span", { class: "tag" }, data.reachable && data.reachable.ok ? "readable" : "unreachable")),
      el("div", { class: "storage-counts" },
        el("div", {}, el("strong", {}, String((data.counts && data.counts.chats) || 0)), el("span", {}, "chats")),
        el("div", {}, el("strong", {}, String((data.counts && data.counts.memory_drawers) || 0)), el("span", {}, "memory .md")),
        el("div", {}, el("strong", {}, String((data.counts && data.counts.artifacts) || 0)), el("span", {}, "artifacts"))),
      el("table", { class: "storage-files" },
        ...(data.files || []).map((f) =>
          el("tr", {},
            el("td", {}, f.label),
            el("td", {}, el("code", {}, f.path)),
            el("td", {}, f.exists ? `${f.bytes} B` : el("span", { class: "muted" }, "not created yet"))))));
  }

  // Which browser an external link opens in. The privacy crowd runs Firefox, this machine runs Brave,
  // and a Chromium opens the link as its own app window while Firefox can only take a URL — so the
  // list says which is which rather than pretending the choice is symmetric.
  // Which browser an external link opens in. Three kinds of answer, all legitimate: whatever the
  // desktop says (the stock behaviour, and the default), ask me each time, or a specific browser —
  // and the specific list comes from the desktop's own menu rather than a set this app invented.
  function browserPreferenceSection() {
    const wrap = el("section", { class: "settings-section" });
    const status = el("p", { class: "hint" }, "Reading the browsers this desktop knows about…");
    const select = el("select", { class: "first-run-select", "aria-label": "Browser for external links" });
    wrap.append(el("h2", {}, "Browser"), select, status);

    rpc("AppPreferences", "listBrowsers")
      .then((res) => {
        const browsers = (res && res.browsers) || [];
        const stock = (res && res.stock) || {};
        const current = (res && res.preference) || "system";
        const options = [
          { id: "system", name: `System default${stock.name ? ` — ${stock.name}` : ""}` },
          { id: "ask", name: "Ask me each time" },
        ].concat(browsers.map((b) => ({ id: b.id, name: b.name })));
        // The saved value may be an id, a binary name or a .desktop id; match any of them.
        const savedDesktop = browsers.find((b) => b.desktopId === current || b.id === current);
        select.replaceChildren(
          ...options.map((o) => {
            const opt = el("option", { value: o.id }, o.name);
            if (o.id === current || (savedDesktop && o.id === savedDesktop.id)) opt.selected = true;
            return opt;
          }),
        );
        if (stock.desktopId && !options.some((o) => o.id === (savedDesktop && savedDesktop.id))) {
          // A preference pointing at a browser that is no longer installed: say so rather than
          // silently reverting to the default.
          status.textContent = `Saved choice "${current}" is not installed any more — falling back to the system default.`;
        }
        select.addEventListener("change", async () => {
          const value = select.value;
          localStorage.setItem("quixi.externalBrowser", value);
          const target = browsers.find((b) => b.id === value);
          await rpc("AppPreferences", "setPreference", ["externalBrowser", target ? (target.desktopId || value) : value]);
          status.textContent =
            value === "system"
              ? `Links go to ${stock.name || "the desktop default"}.`
              : value === "ask"
                ? "Links will ask which browser, every time."
                : `Links open in ${target ? target.name : value}.`;
        });
        status.textContent = [
          browsers.length ? `${browsers.length} browsers on this desktop: ${browsers.map((b) => b.name).join(", ")}.` : "No browsers were found in the desktop menu.",
          stock.name ? `System default is ${stock.name}.` : "",
        ].filter(Boolean).join(" ");
        wrap.append(
          el(
            "p",
            { class: "hint" },
            "Chromium browsers — Brave, Chrome — can be driven by the agent while you keep using the one you have open. Firefox, FireDragon, Librewolf and Mullvad are driven the other way: the agent starts them under its own driver with a separate profile, so your session is untouched.",
          ),
        );
      })
      .catch(() => {
        status.textContent = "Could not read the installed browsers.";
      });
    return wrap;
  }


  // Everything that changes how it looks, in one place. This function was written when the settings were
  // split and then lost in a copy between trees: the call site survived, so the tab rendered an empty
  // page and threw a ReferenceError nothing surfaced. A list, so the caller can spread it.
  function visualsBlocks() {
    return [
          el("h2", {}, "Appearance"),
          el(
            "p",
            { class: "muted" },
            "Choose a look that feels right for your workspace.",
          ),
          el(
            "div",
            { class: "theme-options", role: "group", "aria-label": "Theme" },
            ...[
              ["retro", "Retro"],
              ["light", "Light"],
              ["dark", "Dark"],
              ["volkdude", "volkdude85"],
              ["amber", "Amber"],
              ["ice", "Ice"],
              ["custom", "Custom"],
              ["system", "System"],
            ].map(([value, label]) => {
              const choice = button(
                [
                  el(
                    "span",
                    { class: "theme-swatch " + value, "aria-hidden": "true" },
                    el("span"),
                    el("span"),
                  ),
                  el(
                    "span",
                    { class: "theme-label" },
                    label,
                    (localStorage.getItem("quixi.theme") || "dark") === value
                      ? icon("check", 14)
                      : null,
                  ),
                ],
                () => {
                  rememberPreference("theme", value);
                  applyTheme();
                  renderPage();
                },
                "theme-option" +
                  ((localStorage.getItem("quixi.theme") || "dark") === value
                    ? " selected"
                    : ""),
              );
              choice.setAttribute("aria-label", "Use " + value + " theme");
              choice.setAttribute(
                "aria-pressed",
                String((localStorage.getItem("quixi.theme") || "dark") === value),
              );
              return choice;
            }),
          ),
          el(
            "div",
            { class: "font-grid" },
            el(
              "label",
              {},
              "Interface font",
              select(
                [
                  ["", "Default"],
                  ["system-ui, sans-serif", "System sans"],
                  ["ui-monospace, SFMono-Regular, Menlo, monospace", "Monospace"],
                  ["Georgia, 'Times New Roman', serif", "Serif"],
                  ["Atkinson Hyperlegible, Verdana, sans-serif", "Hyperlegible"],
                ],
                localStorage.getItem("quixi.fontFamily") || "",
                (v) => {
                  v
                    ? rememberPreference("fontFamily", v)
                    : localStorage.removeItem("quixi.fontFamily");
                  applyAppearance();
                },
              ),
            ),
            el(
              "label",
              {},
              "Text size",
              select(
                [
                  ["", "Default (14)"],
                  ["12", "12"],
                  ["13", "13"],
                  ["15", "15"],
                  ["16", "16"],
                  ["18", "18"],
                  ["20", "20"],
                ],
                localStorage.getItem("quixi.fontSize") || "",
                (v) => {
                  v
                    ? rememberPreference("fontSize", v)
                    : localStorage.removeItem("quixi.fontSize");
                  applyAppearance();
                },
              ),
            ),
          ),
          el(
            "p",
            { class: "muted", style: "margin-top:14px" },
            "Custom theme overrides the base colours; leave a swatch alone to inherit the theme.",
          ),
          el(
            "div",
            { class: "swatch-row" },
            colourControl("bg", "Background"),
            colourControl("text", "Text"),
            colourControl("accent", "Accent"),
          ),
          el("h2", { style: "margin-top:30px" }, "Task list"),
          el(
            "p",
            { class: "muted" },
            "The numbered list of tasks that sits above the composer. It stays visible while the agent works and shrinks to a single line when there is nothing on it.",
          ),
          el(
            "div",
            { class: "toggle-row" },
            el(
              "label",
              { class: "toggle" },
              el("input", {
                type: "checkbox",
                checked: localStorage.getItem("quixi.showTasks") !== "0",
                onchange: (event) => {
                  rememberPreference("showTasks", event.target.checked ? "1" : "0");
                  render();
                },
              }),
              el("span", {}, "Show the task list above the composer"),
            ),
          ),
          el("h2", { style: "margin-top:30px" }, "Surfaces"),
          el(
            "p",
            { class: "muted" },
            "Boxed surfaces give every panel a defined edge. Translucency blurs what is behind a panel where the compositor supports it; where it does not, the panel simply stays solid.",
          ),
          el(
            "div",
            { class: "toggle-row" },
            el(
              "label",
              { class: "toggle" },
              el("input", {
                type: "checkbox",
                checked: localStorage.getItem("quixi.boxing") !== "0",
                onchange: (event) => {
                  rememberPreference("boxing", event.target.checked ? "1" : "0");
                  applyTheme();
                },
              }),
              el("span", {}, "Boxed surfaces"),
            ),
          ),
          el("h2", { style: "margin-top:30px" }, "Transparency"),
          el(
            "p",
            { class: "muted" },
            "How much of the workspace behind a surface shows through it. 100% is solid: the surface paints its own colour and nothing else. Below about 60% the text starts to fight what is behind it. The window itself is opaque at every setting, so there is no second control and no leftover glass.",
          ),
          el(
            "label",
            { class: "slider-row" },
            el("span", {}, "Panel opacity"),
            (() => {
              const readout = el("span", { class: "slider-value" }, `${localStorage.getItem("quixi.panelOpacity") || "100"}%`);
              const input = el("input", {
                type: "range", min: 40, max: 100, step: 2,
                value: localStorage.getItem("quixi.panelOpacity") || "100",
                oninput: (event) => {
                  const pct = event.target.value;
                  document.documentElement.style.setProperty("--panel-alpha", (Number(pct) / 100).toFixed(2));
                  readout.textContent = `${pct}%`;
                  rememberPreferenceSoon("panelOpacity", pct);
                  // The surfaces are only part of it: the window itself has to be blended by the
                  // compositor, or 100% and 40% look the same over an opaque window. One number,
                  // sent both ways, is the only way the dial tells the truth.
                  rpc("AppPreferences", "setPreference", ["windowOpacity", Number(pct)]).catch(() => {});
                },
              });
              return [input, readout];
            })(),
          ),
          el("h2", { style: "margin-top:26px" }, "Background"),
          el(
            "p",
            { class: "muted" },
            "A slow drift behind the interface, drawn by the app rather than a wallpaper. Off by default; it costs a little GPU and some people hate it.",
          ),
          el(
            "div",
            { class: "toggle-row" },
            el("label", { class: "toggle" },
              el("input", {
                type: "checkbox",
                checked: localStorage.getItem("quixi.backgroundMotion") === "1",
                onchange: (event) => { rememberPreference("backgroundMotion", event.target.checked ? "1" : "0"); applyTheme(); },
              }),
              el("span", {}, "Moving background")),
            el("label", { class: "toggle" },
              el("input", {
                type: "checkbox",
                checked: localStorage.getItem("quixi.backgroundGrid") === "1",
                onchange: (event) => { rememberPreference("backgroundGrid", event.target.checked ? "1" : "0"); applyTheme(); },
              }),
              el("span", {}, "Grid overlay")),
          ),
    ];
  }


  // Audio: what the app speaks through, what it listens on, and which model does the listening and the
  // talking. Local is the default because both are already here — Whisper on this machine and Kokoro on
  // this machine — and a cloud default would send a recording of your voice somewhere to find that out.
  // Audio, in three parts because they are three different decisions: what listens (STT), what speaks
  // (TTS), and whether the two run together as a conversation. Each says what it is, what this build
  // runs underneath, and what the choices cost.
  function audioPageSections() {
    const wrap = el("section", { class: "settings-section" });
    const devices = el("p", { class: "hint" }, "Reading the audio devices on this machine…");
    const voiceStatus = el("p", { class: "hint" }, "Checking what is running…");
    const sinkSelect = el("select", { class: "first-run-select", "aria-label": "Output device" });
    const sourceSelect = el("select", { class: "first-run-select", "aria-label": "Microphone" });

    // ---- STT ----
    const sttEngine = el("select", { class: "first-run-select" });
    sttEngine.append(
      el("option", { value: "local" }, "Local — Whisper on this machine (default)"),
      el("option", { value: "cloud" }, "Cloud — a provider transcribes the audio"),
      el("option", { value: "off" }, "Off — no speech to text"),
    );
    sttEngine.value = localStorage.getItem("quixi.sttModel") || "local";

    // ---- TTS ----
    const ttsEngine = el("select", { class: "first-run-select" });
    ttsEngine.append(
      el("option", { value: "local" }, "Local — Kokoro on this machine (default)"),
      el("option", { value: "cloud" }, "Cloud — a provider's voice"),
      el("option", { value: "off" }, "Off — read aloud disabled"),
    );
    ttsEngine.value = localStorage.getItem("quixi.ttsModel") || "local";
    const ttsVoice = el("input", {
      type: "text", class: "first-run-key", spellcheck: false,
      value: localStorage.getItem("quixi.ttsVoice") || "af_heart",
    });

    // Conversation mode used to be a setting here — a mode and a push-to-talk key. The composer's
    // Mic and Speaker switches are that mode now, and a second way to say the same thing is a second
    // thing to get out of step, so it is gone rather than hidden.
    const save = () => {
      const pairs = [
        ["sttModel", sttEngine.value],
        ["ttsModel", ttsEngine.value],
        ["ttsVoice", ttsVoice.value],
      ];
      for (const [k, v] of pairs) {
        localStorage.setItem(`quixi.${k}`, v);
        rememberPreferenceSoon(k, v);
      }
    };
    for (const el2 of [sttEngine, ttsEngine, ttsVoice]) {
      el2.addEventListener("change", save);
    }

    wrap.append(
      el("h2", {}, "Speech to text"),
      el("p", { class: "muted" }, "Turning your voice into words. Locally this is Whisper — the same family of models people run offline — on this machine's CPU or GPU, a few seconds per clip, and the audio never leaves the box. Cloud sends the recording to whichever provider is configured."),
      el("label", { class: "settings-field" }, el("span", {}, "Input"), sourceSelect),
      el("label", { class: "settings-field" }, el("span", {}, "Engine"), sttEngine),

      el("p", { class: "muted", style: "margin-top:22px" }, "The Mic and Speaker switches beside the composer follow what is chosen here. Nothing here is repeated in the toolbar."),

      el("h2", { style: "margin-top:28px" }, "Text to speech"),
      el("p", { class: "muted" }, "Reading replies aloud. Locally this is Kokoro, a small voice model that runs on this machine and needs no account; the voice is a name, not a preset list, because the voices are files."),
      el("label", { class: "settings-field" }, el("span", {}, "Output"), sinkSelect),
      el("label", { class: "settings-field" }, el("span", {}, "Engine"), ttsEngine),
      el("label", { class: "settings-field" }, el("span", {}, "Voice"), ttsVoice),

      devices,
      voiceStatus,
    );

    rpc("AudioDevices", "list")
      .then((res) => {
        const sinks = (res && res.sinks) || [];
        const sources = ((res && res.sources) || []).filter((s) => !/\.monitor$/.test(s.name));
        const savedSink = localStorage.getItem("quixi.audioOutput") || "";
        const savedSource = localStorage.getItem("quixi.audioInput") || "";
        const fill = (select, items, saved, fallbackLabel) => {
          select.replaceChildren(
            el("option", { value: "" }, fallbackLabel),
            ...items.map((d) => {
              const o = el("option", { value: d.name }, d.label || d.name);
              if (d.name === saved) o.selected = true;
              return o;
            }),
          );
        };
        fill(sinkSelect, sinks, savedSink, "System default");
        fill(sourceSelect, sources, savedSource, "System default");
        sinkSelect.addEventListener("change", () => {
          localStorage.setItem("quixi.audioOutput", sinkSelect.value);
          rememberPreferenceSoon("audioOutput", sinkSelect.value);
        });
        sourceSelect.addEventListener("change", () => {
          localStorage.setItem("quixi.audioInput", sourceSelect.value);
          rememberPreferenceSoon("audioInput", sourceSelect.value);
        });
        devices.textContent = `${sinks.length} outputs, ${sources.length} inputs found${res && res.defaultSink ? ` · system default is ${res.defaultSink}` : ""}.`;
      })
      .catch(() => {
        devices.textContent = "Could not read the audio devices. PipeWire or PulseAudio was not reachable.";
      });

    api("/api/quixi/voice/status")
      .then((st) => {
        const tts = (st && st.tts) || {};
        const stt = (st && st.stt) || {};
        const bits = [
          tts.available ? `voice ready (${tts.backend || "kokoro"})` : "voice not running",
          stt.available ? `transcription ready (${stt.engine || "whisper"})` : "transcription not running",
        ];
        voiceStatus.textContent = `Under the skin: ${bits.join(" · ")}.`;
      })
      .catch(() => {
        voiceStatus.textContent = "Under the skin: could not read the voice services.";
      });

    return wrap;
  }

  function settingsPage(host) {
    const tabs = [
      ["general", "General"],
      ["visuals", "Visuals"],
      ["audio", "Audio"],
      ["persona", "Personas"],
      ["providers", "Providers"],
      ["onboarding", "Onboarding"],
      ["privacy", "Privacy & data"],
      ["about", "About"],
    ];
    const content = el("section", { class: "settings-content" });
    host.replaceChildren(
      header("Settings", "Make the workspace yours."),
      el(
        "div",
        { class: "settings-layout" },
        el(
          "nav",
          { class: "settings-nav", "aria-label": "Settings sections" },
          ...tabs.map(([id, label]) =>
            button(
              label,
              () => {
                state.settingsTab = id;
                renderPage();
              },
              state.settingsTab === id ? "active" : "",
            ),
          ),
        ),
        content,
      ),
    );
    if (state.settingsTab === "general") {
      content.append(browserPreferenceSection());
      content.append(
        el("h2", { style: "margin-top:30px" }, "New tasks"),
        field(
          "Default permission mode",
          select(
            [
              ["default", "Manual"],
              ["auto", "Smart"],
              ["bypassPermissions", "YOLO"],
            ],
            state.permission,
            (v) => {
              state.permission = v;
              localStorage.setItem("quixi.permission", v);
            },
          ),
          "Manual asks before anything that changes a file or runs a command. Smart answers from your history: an action you have already allowed once goes through without asking, and anything you have not seen before still stops and asks. YOLO never asks — every action is approved as it arrives, which is fast, and is exactly as safe as it sounds.",
        ),
        el(
          "div",
          { class: "notice" },
          "Language: English. Use Ctrl+N for a new task, Ctrl+K to search, and Ctrl+, for settings.",
        ),
      );
      capabilityUI.renderDesktopStatus(content);
    } else if (state.settingsTab === "visuals") {
      content.append(...visualsBlocks());
    } else if (state.settingsTab === "audio") {
      content.append(audioPageSections());
    } else if (state.settingsTab === "persona") {
      personaSettings(content);
    } else if (state.settingsTab === "providers") {
      content.append(
        el("h2", {}, "Model providers"),
        el("p", {}, `${state.providers?.configuredCount || 0} configured`),
        button("Manage providers", () => providerDirectory(), "primary"),
      );
    } else if (state.settingsTab === "onboarding") {
      // A legitimate home for first run. The star entry in the sidebar is the development door and
      // stays exactly as it is; this is the one a person can find without being told it exists, and
      // it explains what the wizard decides rather than just offering to show it again.
      const setupDone = !!(state.providers && state.providers.onboardingCompleted === true);
      const answered = state.providers?.configuredCount || 0;
      content.append(
        el("h2", {}, "First run"),
        el(
          "p",
          {},
          setupDone
            ? `Setup was answered on this install, and ${answered} provider${answered === 1 ? " is" : "s are"} configured.`
            : "Setup has not been answered on this install yet.",
        ),
        el(
          "p",
          { class: "muted" },
          "The wizard asks two things: where the models run, and where your memory lives. Neither answer is permanent — the provider list and the memory folder are both here in Settings, and the persona is a file you own. Running it again does not clear any of that; it only asks the questions.",
        ),
        el(
          "div",
          { class: "first-run-actions" },
          button(
            setupDone ? "Run the setup again" : "Open setup",
            () => {
              state.setupDismissed = false;
              navigate("onboarding");
            },
            "reveal",
          ),
          button("Just give me the table", () => { state.setupDismissed = true; navigate("setup"); }, "reveal"),
        ),
      );
    } else if (state.settingsTab === "privacy") {
      // Paths, counts and files — not a promise that things are "stored on this device".
      content.append(
        el("h2", {}, "Where your data actually is"),
        el("p", { class: "muted" }, "Everything this app knows is a file on this machine. You can read it, grep it, back it up or delete it without asking the app."),
        el("div", { class: "storage-panel", id: "storage-locations" }, el("p", { class: "muted" }, "Reading…")),
        el("h3", {}, "What leaves the machine"),
        el("p", { class: "muted" }, "A prompt and its task context go to whichever model provider you selected, and nowhere else. Conversations, memory, persona and settings stay in the directory above."),
        el("h3", {}, "Credentials"),
        el("p", { class: "muted" }, "Provider keys live in the OS keyring when one is available, otherwise in the data directory above. Nothing is sent to us — there is no us to send it to."),
        el("div", { class: "toolbar" },
          button("Re-read locations", async () => { await drawStorageLocations(); }, "quiet"),
          button("Inspect storage status", async () => {
            const status = await api("/api/quixi/storage/status");
            dialog("Conversation storage", [el("pre", {}, JSON.stringify(status, null, 2))]);
          }, "quiet")),
      );
      drawStorageLocations();
    } else
      content.append(
        el("img", {
          src: "/quixi-mark.svg",
          alt: "QuixiDesk",
          width: 58,
          height: 58,
        }),
        el("p", { class: "about-by" }, "volkdude85"),
        el("h2", { style: "margin-top:4px" }, "volkdude85's QuixiDesk"),
        el(
          "p",
          { class: "muted" },
          "A Linux desktop for running an agent against your own machine: your files, your models, your storage.",
        ),
        el("p", {}, "Built on QuixiDesk by QuixiAI · MIT license"),
        el(
          "p",
          { class: "muted" },
          "Runs on GTK and the system webview. What it can do depends on what you have installed — it reports what is missing rather than pretending.",
        ),
        button(
          "Open project website",
          () => openExternal("https://github.com/QuixiAI/QuixiDesk"),
          "quiet",
        ),
      );
  }
  // Appearance is backend state. AppPreferences is the record; localStorage is only the paint cache,
  // so the window comes up in the right theme immediately instead of flashing the default while the
  // bridge answers. Every write goes to both, and a value the backend holds wins at boot.
  const APPEARANCE_KEYS = {
    theme: "quixi.theme",
    fontFamily: "quixi.fontFamily",
    fontSize: "quixi.fontSize",
    sidebarWidth: "quixi.sidebarWidth",
  };
  function adoptPreferences(prefs) {
    if (!prefs || typeof prefs !== "object") return false;
    let changed = false;
    for (const [key, storageKey] of Object.entries(APPEARANCE_KEYS)) {
      const value = prefs[key];
      if (typeof value === "string" && value && localStorage.getItem(storageKey) !== value) {
        localStorage.setItem(storageKey, value);
        changed = true;
      }
    }
    for (const key of ["bg", "text", "accent"]) {
      const value = prefs["custom." + key];
      if (typeof value === "string" && localStorage.getItem("quixi.custom." + key) !== value) {
        localStorage.setItem("quixi.custom." + key, value);
        changed = true;
      }
    }
    return changed;
  }
  function rememberPreference(key, value) {
    const storageKey = APPEARANCE_KEYS[key] || "quixi." + key;
    if (value === null || value === undefined || value === "") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
    rpc("AppPreferences", "setPreference", [key, value]).catch(() => {});
  }
  // A colour slider fires continuously. The paint should follow every pixel; the record on disk
  // should not, so writes behind a drag settle instead of one file write per step.
  const preferenceTimers = new Map();
  function rememberPreferenceSoon(key, value) {
    const storageKey = APPEARANCE_KEYS[key] || "quixi." + key;
    if (value) localStorage.setItem(storageKey, value);
    clearTimeout(preferenceTimers.get(key));
    preferenceTimers.set(
      key,
      setTimeout(() => {
        preferenceTimers.delete(key);
        rpc("AppPreferences", "setPreference", [key, value]).catch(() => {});
      }, 200),
    );
  }
  // WebKitGTK's <input type=color> is a palette grid: you can pick a hue but there is no
  // saturation control, so a custom accent can never be a neon green. These sliders are the control.
  function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
    if (!m) return { h: 210, s: 12, l: 12 };
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    // Keep the fraction: rounding hue to whole degrees cannot reproduce #00ff41 (135.29 -> #00ff40).
    h = Math.round(((h * 60 + 360) % 360) * 100) / 100;
    const l = (max + min) / 2;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hslToHex(h, s, l) {
    const sat = Math.min(100, Math.max(0, s)) / 100;
    const lig = Math.min(100, Math.max(0, l)) / 100;
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lig - c / 2;
    const rgb = h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
      : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c]
      : h < 300 ? [x, 0, c]
      : [c, 0, x];
    return "#" + rgb.map((v) =>
      Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  // One colour: a live swatch, three sliders, and the hex. The sliders are authoritative while you
  // drag — deriving HSL back out of the 8-bit hex on every step drifts (hue 135 / sat 100 / light 50
  // lands on #00ff3c instead of #00ff41 after a few nudges), so the hex is only re-read when you type
  // in it.
  function colourControl(key, label) {
    let value = localStorage.getItem("quixi.custom." + key) || (key === "bg" ? "#191c20" : "#edf0f2");
    let current = hexToHsl(value);
    const swatch = el("span", { class: "colour-swatch", style: "background:" + value });
    const hex = el("input", { type: "text", value: value, spellcheck: "false", class: "colour-hex" });
    const sliders = {};
    const paint = (record) => {
      value = hslToHex(current.h, current.s, current.l);
      swatch.style.background = value;
      hex.value = value;
      (record || rememberPreference)("custom." + key, value);
      rememberPreference("theme", "custom");
      applyTheme();
    };
    const slider = (channel, max, text) => {
      const input = el("input", {
        type: "range", min: 0, max, value: current[channel], class: "colour-slider",
        "aria-label": label + " " + text,
        oninput: (event) => {
          current[channel] = Number(event.target.value);
          paint(rememberPreferenceSoon);
        },
      });
      sliders[channel] = input;
      return el("label", { class: "colour-slider-row" }, el("span", {}, text), input);
    };
    hex.onchange = () => {
      const typed = hex.value.trim();
      if (!/^#?[0-9a-f]{6}$/i.test(typed)) {
        hex.value = value;
        return;
      }
      current = hexToHsl((typed[0] === "#" ? "" : "#") + typed);
      for (const [channel, input] of Object.entries(sliders)) input.value = current[channel];
      paint();
    };
    return el(
      "div",
      { class: "colour-control" },
      el("div", { class: "colour-head" }, swatch, el("strong", {}, label), hex),
      slider("h", 360, "Hue"),
      slider("s", 100, "Saturation"),
      slider("l", 100, "Lightness"),
    );
  }
  // The volkdude85 theme is the retro palette with the mouth left in. Everything that reads in a
  // voice asks this, so the copy and the colours can never drift apart.
  function volkdudeVoice() {
    return (localStorage.getItem("quixi.theme") || "retro") === "volkdude";
  }

  function applyTheme() {
    const choice = localStorage.getItem("quixi.theme") || "retro";
    document.documentElement.dataset.theme =
      choice === "system"
        ? matchMedia("(prefers-color-scheme:dark)").matches
          ? "dark"
          : "light"
        : choice;
    applyAppearance();
  }
  // Font and custom colours are applied as inline variables on :root, so they layer over whichever
  // theme is selected instead of replacing it. Clearing a value falls back to the stylesheet.
  function applyAppearance() {
    const root = document.documentElement;
    const size = localStorage.getItem("quixi.fontSize");
    size ? root.style.setProperty("--ui-font-size", size + "px") : root.style.removeProperty("--ui-font-size");
    const font = localStorage.getItem("quixi.fontFamily");
    font ? root.style.setProperty("--ui-font", font) : root.style.removeProperty("--ui-font");
    // Custom colours belong to the Custom theme. They used to be written onto :root
    // unconditionally, so a colour picked once overrode every theme chosen afterwards — the palette
    // said phosphor green and the window rendered somebody's old teal, with nothing on screen to
    // explain why.
    const theme = localStorage.getItem("quixi.theme") || "retro";
    const custom = theme === "custom";
    // Two surface options that are pure CSS flags on :root, so the stylesheet owns the look.
    // The dial is the only thing that decides how see-through a surface is, applied at startup as
    // well as while the slider moves — a saved preference that only takes effect after you touch
    // the slider is a preference the app forgot. Default 100 is solid.
    root.style.setProperty("--panel-alpha", ((Number(localStorage.getItem("quixi.panelOpacity") || 100)) / 100).toFixed(2));
    // The window gets the same number, so a saved 70% is really 70% after a restart rather than
    // only while the slider is being dragged.
    rpc("AppPreferences", "setPreference", ["windowOpacity", Number(localStorage.getItem("quixi.panelOpacity") || 100)]).catch(() => {});
    root.dataset.backgroundMotion = localStorage.getItem("quixi.backgroundMotion") === "1" ? "on" : "off";
    root.dataset.backgroundGrid = localStorage.getItem("quixi.backgroundGrid") === "1" ? "on" : "off";
    root.dataset.boxing = localStorage.getItem("quixi.boxing") === "0" ? "off" : "on";
    for (const key of ["bg", "text", "accent"]) {
      const value = custom ? localStorage.getItem("quixi.custom." + key) : null;
      value
        ? root.style.setProperty("--" + key, value)
        : root.style.removeProperty("--" + key);
    }
  }
  async function providerDirectory() {
    await loadProviders();
    const body = el("div", { class: "provider-directory" });
    let query = "";
    const draw = () => {
      body.replaceChildren(
        el(
          "p",
          {},
          "Connect the model services you want to use. Credentials stay in the local provider settings; requests go directly to the selected endpoint.",
        ),
        el(
          "div",
          { class: "toolbar" },
          el(
            "span",
            { class: "tag" },
            `${state.providers.configuredCount} configured`,
          ),
          button(
            "Detect local servers",
            async () => {
              const r = await api("/api/quixi/providers/detect-local", {});
              if (r.error) throw new Error(r.error);
              await loadProviders();
              draw();
            },
            "quiet",
          ),
        ),
        el("input", {
          type: "search",
          spellcheck: false,
          autocapitalize: "off",
          autocorrect: "off",
          value: query,
          class: "provider-filter",
          placeholder: "Find a provider…",
          "aria-label": "Filter providers",
          onInput: (e) => {
            query = e.target.value;
            for (const card of body.querySelectorAll(".provider-card"))
              card.classList.toggle(
                "hidden",
                !card.dataset.name.includes(query.toLowerCase()),
              );
            body
              .querySelector(".provider-empty")
              ?.classList.toggle(
                "hidden",
                !!body.querySelector(".provider-card:not(.hidden)"),
              );
          },
        }),
        el(
          "div",
          { class: "cards" },
          ...state.providers.providers
            .slice()
            .sort((a, b) => Number(b.configured) - Number(a.configured))
            .map((p) =>
              el(
                "article",
                {
                  class:
                    "card provider-card" +
                    (!p.name.toLowerCase().includes(query.toLowerCase())
                      ? " hidden"
                      : "") +
                    (p.id === state.providers.activeProvider
                      ? " selected"
                      : ""),
                  "data-name": p.name.toLowerCase(),
                },
                el(
                  "div",
                  { class: "provider-header" },
                  el(
                    "span",
                    { class: "provider-badge", "aria-hidden": "true" },
                    p.name.slice(0, 1),
                  ),
                  el(
                    "div",
                    {},
                    el("h3", {}, p.name),
                    el(
                      "small",
                      {},
                      p.id === state.providers.activeProvider && p.configured
                        ? "Active provider"
                        : p.configured
                          ? "Connected"
                          : p.category === "local"
                            ? "Local service"
                            : "Not connected",
                    ),
                  ),
                ),
                el(
                  "p",
                  {},
                  p.category === "local"
                    ? "Connect to a model service on your computer."
                    : p.id === "custom"
                      ? "Use your own compatible model endpoint."
                      : "Connect directly to this provider.",
                ),
                el(
                  "div",
                  { class: "card-actions" },
                  button(
                    "Configure",
                    () =>
                      providerEditor(p, async () => {
                        await loadProviders();
                        draw();
                      }),
                    "",
                  ),
                  p.configured
                    ? button(
                        "Use provider",
                        async () => {
                          const r = await api(
                            "/api/quixi/providers/complete-onboarding",
                            {
                              activeProvider: p.id,
                              activeModel: p.selectedModel,
                            },
                          );
                          if (r.error) throw new Error(r.error);
                          await loadProviders();
                          toast("Active provider updated.");
                          draw();
                        },
                        "quiet",
                      )
                    : null,
                ),
              ),
            ),
        ),
        el(
          "p",
          { class: "provider-empty hidden hint", role: "status" },
          "No providers match. Try another name.",
        ),
      );
    };
    draw();
    dialog("Model providers", body, { wide: true });
  }
  async function providerEditor(p, changed) {
    const error = el("div", { class: "form-error", role: "alert" });
    const key = el("input", {
      type: "password",
      autocomplete: "new-password",
      placeholder: p.configured
        ? "Leave blank to keep the stored credential"
        : p.keyPlaceholder || "API key",
      "aria-label": "API key",
    });
    const base = el("input", {
      type: "url",
      value: p.baseUrl || "",
      required: true,
    });
    const format = select(
      [
        ["openai", "Chat completions API"],
        ["anthropic", "Messages API"],
      ],
      p.apiFormat || "openai",
    );
    const content = el(
      "div",
      {},
      el(
        "p",
        {},
        p.category === "local"
          ? "Connect to a model service on your computer."
          : p.id === "custom"
            ? "Use your own compatible model endpoint."
            : "Connect directly to this provider.",
      ),
      field(
        "API key",
        key,
        p.apiKeyMasked
          ? "Stored credential: " + p.apiKeyMasked
          : "Never paste a key into a conversation.",
      ),
      field("Endpoint", base),
      el("p", { class: "hint" }, "Models are loaded from the provider when you save. Choose a model in the chat dropdown; unadvertised models can also be added there."),
    );
    if (p.id === "custom") content.append(field("API format", format));
    const payload = () => ({
      providerId: p.id,
      ...(key.value ? { apiKey: key.value } : {}),
      baseUrl: base.value.trim(),
      apiFormat: format.value,
      refreshModels: true,
      setAsActive: true,
    });
    let oauthTimer;
    const actions = el(
      "div",
      { class: "form-actions" },
      button("Cancel", () => d.close(), "quiet"),
      button(
        "Test connection",
        async () => {
          try {
            error.textContent = "Testing…";
            const r = await api("/api/quixi/providers/test", payload());
            error.textContent = r.ok
              ? r.message || "Connection succeeded."
              : r.error || r.message || "Connection failed.";
          } catch (e) {
            error.textContent = e.message;
          }
        },
        "quiet",
      ),
      button(
        "Save & use provider",
        async () => {
          try {
            error.textContent = "Saving provider and loading models…";
            const r = await api("/api/quixi/providers/save", payload());
            if (r.error) throw new Error(r.error);
            const r2 = await api("/api/quixi/providers/complete-onboarding", {
              activeProvider: p.id,
              activeModel: r.activeModel || "",
            });
            if (r2.error) throw new Error(r2.error);
            await loadProviders();
            await changed?.();
            d.close();
            toast(r.modelDiscovery?.ok === false
              ? "Provider saved. Could not load its models: " + r.modelDiscovery.message
              : "Provider saved. Models are available in the chat dropdown.", r.modelDiscovery?.ok === false);
          } catch (e) {
            error.textContent = e.message;
          }
        },
        "primary",
      ),
    );
    if (p.supportsOauth || p.supportsOAuth) {
      const oauth = el("div", {});
      content.append(
        el("hr"),
        button(
          "Sign in with your account",
          async () => {
            try {
              const r = await api("/api/quixi/providers/oauth/start", {
                providerId: p.id,
                openBrowser: false,
              });
              if (r.error) throw new Error(r.error);
              const url = r.verificationUrl || r.authorizeUrl;
              oauth.replaceChildren(
                el(
                  "p",
                  {},
                  "Complete sign-in in your browser, then check the connection.",
                ),
                r.userCode ? el("pre", {}, r.userCode) : null,
                url
                  ? el(
                      "div",
                      { class: "row" },
                      button(
                        "Open verification page",
                        () => openExternal(url),
                        "primary",
                      ),
                      button("Copy link", async () => {
                        await copy(url);
                        toast("Verification link copied.");
                      }),
                    )
                  : null,
                button("Check sign-in", async () => {
                  const v = await api("/api/quixi/providers/oauth/poll", {
                    providerId: p.id,
                    forceComplete: true,
                  });
                  if (v.error) throw new Error(v.error);
                  await loadProviders();
                  await changed?.();
                  if (
                    state.providers.providers.find((x) => x.id === p.id)
                      ?.configured
                  ) {
                    toast("Account connected.");
                    d.close();
                  } else toast("Sign-in is still pending.");
                }),
              );
            } catch (e) {
              error.textContent = e.message;
            }
          },
          "quiet",
        ),
        oauth,
      );
    }
    if (p.configured && ["custom", "openrouter"].includes(p.id))
      content.append(
        button(
          "Manage models",
          () => {
            d.close();
            modelPicker(p.id);
          },
          "quiet",
        ),
      );
    content.append(error, actions);
    const d = dialog(p.name, content);
    d.addEventListener("close", () => {
      clearInterval(oauthTimer);
      key.value = "";
    });
  }
  async function modelPicker(providerId) {
    await loadProviders();
    let providers = state.providers.providers.filter((p) => p.configured);
    if (!providers.length) {
      providerDirectory();
      return;
    }
    let selected = providerId || state.providers.activeProvider;
    const ps = select(
      providers.map((p) => [p.id, p.name]),
      selected,
      (v) => {
        selected = v;
        query.value = "";
        catalogStatus.textContent = "";
        draw();
      },
      { "aria-label": "Provider" },
    );
    const models = el("div", { class: "model-options" });
    const additions = el("div", { class: "manual-models" });
    const query = el("input", {
      type: "search",
      placeholder: "Find a model…",
      "aria-label": "Filter models",
      onInput: () => draw(),
    });
    const catalogStatus = el("p", { class: "hint", role: "status" });
    const refresh = button("Refresh models", async () => {
      refresh.disabled = true;
      catalogStatus.textContent = "Loading models…";
      try {
        const r = await api("/api/quixi/providers/test", { providerId: selected });
        await loadProviders();
        providers = state.providers.providers.filter((p) => p.configured);
        catalogStatus.textContent = r.message || (r.ok ? "Models loaded." : "Could not load models.");
        draw();
      } catch (e) { catalogStatus.textContent = e.message; }
      finally { refresh.disabled = false; }
    }, "quiet");
    const anchor=document.querySelector(".model-picker-trigger")?.getBoundingClientRect();
    const d = dialog("Choose model", [
      field("Provider", ps),
      query,
      refresh,
      catalogStatus,
      models,
      additions,
    ]);
    positionPopover(d, anchor);
    function draw() {
      const p = providers.find((x) => x.id === selected) || providers[0];
      models.replaceChildren(
        ...[...(p.models || [])]
          .filter((m) => `${m.id} ${m.label || ""}`.toLowerCase().includes(query.value.trim().toLowerCase()))
          .sort(
            (a, b) =>
              Number(b.id === p.selectedModel) -
                Number(a.id === p.selectedModel) ||
              Number(p.customModels?.includes(b.id)) -
                Number(p.customModels?.includes(a.id)),
          )
          .map((m) =>
            button(
              [
                el(
                  "span",
                  { class: "grow" },
                  m.label || m.id,
                  p.customModels?.includes(m.id)
                    ? el(
                        "small",
                        { class: "hint model-origin" },
                        "Added manually",
                      )
                    : null,
                ),
                m.id === p.selectedModel ? icon("check", 14) : null,
              ],
              async () => {
                const r = await api("/api/quixi/providers/save", {
                  providerId: p.id,
                  selectedModel: m.id,
                  setAsActive: true,
                });
                if (r.error) throw new Error(r.error);
                if (session())
                  await rpc(service(session()), "setModel", [state.id, m.id]);
                await loadProviders();
                d.close();
                renderPage();
                toast("Model updated.");
              },
              "list-row",
            ),
          ),
      );
      if (!models.childElementCount)
        models.append(el("p", { class: "hint" }, query.value.trim()
          ? "No matching models. Try another search."
          : "No models loaded yet. Refresh the catalog or add an unadvertised model below."));
      additions.replaceChildren();
      if (["custom", "openrouter"].includes(p.id)) {
        const input = el("input", {
          placeholder: "e.g. organization/model-name",
          "aria-label": "Model ID",
          autocomplete: "off",
          autocapitalize: "off",
          spellcheck: "false",
        });
        const error = el("div", { class: "form-error", role: "alert" });
        const submit = button(
          "Add model",
          async () => {
            const id = input.value.trim();
            if (!id) {
              error.textContent = "Enter a model ID.";
              input.focus();
              return;
            }
            submit.disabled = true;
            try {
              const r = await api("/api/quixi/providers/save", {
                providerId: p.id,
                customModel: id,
                selectCustomModel: false,
                setAsActive: false,
              });
              if (r.error) throw new Error(r.error);
              await loadProviders();
              providers = state.providers.providers.filter((p) => p.configured);
              query.value = "";
              draw();
              toast("Model saved. Select it above when you’re ready.");
            } catch (e) {
              error.textContent = e.message;
            } finally {
              submit.disabled = false;
            }
          },
          "quiet",
        );
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit.click();
          }
        });
        additions.append(
          el("hr"),
          el("details", {},
          el("summary", {}, "Add an unadvertised model"),
          el(
            "p",
            { class: "hint" },
            "Use an exact model ID even if this provider doesn’t advertise it. Adding a model keeps your current selection.",
          ),
          field("Model ID", input),
          error,
          submit,
          ),
        );
      }
    }
    draw();
  }
  async function openExternal(url, forceBrowser = null) {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol))
      throw new Error("Only HTTP and HTTPS links can be opened.");
    const pref = localStorage.getItem("quixi.externalBrowser") || "system";
    if (!forceBrowser && pref === "ask") {
      const choice = await askWhichBrowser();
      if (!choice) return;                       // dismissed: no link opened, nothing silently guessed
      return openExternal(url, choice);
    }
    await api("/__eipc__/open-external", {
      url: parsed.href,
      ...(forceBrowser ? { browser: forceBrowser } : {}),
    });
  }

  // "Ask each time" is only a real option if there is something to ask with. The list is whatever
  // the desktop menu declares, so a browser this app has never heard of still appears here.
  async function askWhichBrowser() {
    let info = null;
    try {
      info = await rpc("AppPreferences", "listBrowsers");
    } catch {
      return "system";
    }
    const browsers = (info && info.browsers) || [];
    const stock = (info && info.stock) || {};
    return new Promise((resolve) => {
      let decided = false;
      const pick = (value) => {
        decided = true;
        d.close();
        resolve(value);
      };
      const d = dialog(
        "Open in which browser?",
        el(
          "div",
          { class: "browser-chooser" },
          el("p", { class: "muted" }, "Remember the choice in Settings → General → Browser, or pick one now just for this link."),
          el(
            "div",
            { class: "browser-chooser-list" },
            button(
              `System default${stock.name ? ` (${stock.name})` : ""}`,
              () => pick("system"),
              "",
            ),
            ...browsers.map((b) =>
              button(b.name, () => pick(b.desktopId || b.id), ""),
            ),
          ),
        ),
      );
      d.addEventListener("close", () => { if (!decided) resolve(null); });
    });
  }
  async function toggleBrowser() {
    state.browser = !state.browser;
    if (state.browser) state.browserState = await api("/api/quixi/browser");
    renderPage();
  }
  async function browserAction(action, extra = {}) {
    state.browserState = await api("/api/quixi/browser", {
      action,
      tabId: state.browserState?.selectedTabId,
      ...extra,
    });
    const host = document.getElementById("page-host");
    renderBrowser(host);
  }
  let browserRenderVersion = 0;

  // Browsers this desktop declares, cached for the session. The panel header needs them synchronously
  // — a dropdown that appears a second after the pane opens is a worse answer than a stale list.
  let browserCatalogue = null;
  function loadBrowserCatalogue() {
    if (!browserCatalogue) {
      browserCatalogue = rpc("AppPreferences", "listBrowsers")
        .then((res) => ({
          list: (res && res.browsers) || [],
          stock: (res && res.stock) || {},
          preference: (res && res.preference) || "system",
        }))
        .catch(() => ({ list: [], stock: {}, preference: "system" }));
    }
    return browserCatalogue;
  }
  function refreshBrowserCatalogue() {
    browserCatalogue = null;
    return loadBrowserCatalogue();
  }
  // The order is deliberate: the two this build has tooling for first, then everything else the
  // desktop offers. A browser that cannot be driven is still a legitimate way to read a page.
  function orderBrowsers(list) {
    const rank = (b) => {
      const n = `${b.name || ""} ${b.exec || ""}`.toLowerCase();
      if (n.includes("brave")) return 0;
      if (n.includes("firefox") || n.includes("firedragon") || n.includes("librewolf") || n.includes("mullvad")) return 1;
      return 2;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  }
  function currentExternalBrowser() {
    return localStorage.getItem("quixi.externalBrowser") || "system";
  }
  function currentExternalBrowserName(cat) {
    const pref = currentExternalBrowser();
    if (pref === "ask") return "your browser (asked each time)";
    if (pref === "system") return (cat && cat.stock && cat.stock.name) || "the system default";
    const hit = ((cat && cat.list) || []).find((b) => b.id === pref || b.desktopId === pref);
    return hit ? hit.name : (cat && cat.stock && cat.stock.name) || "your browser";
  }


  // The dropdown sits where the panel has always said which browser gets the page. Before it, the
  // name was hardcoded in three places ("Open in Brave", "Pages open in Brave") and changing it meant
  // a rebuild; now it is one control that lists what this desktop actually has.
  function browserPick() {
    const select = el("select", { class: "browser-pick", "aria-label": "Browser for opened pages" });
    const paint = (cat) => {
      state.browserCat = cat;
      const list = orderBrowsers(cat.list || []);
      const pref = currentExternalBrowser();
      const options = [
        { id: "system", name: `System default${cat.stock && cat.stock.name ? ` — ${cat.stock.name}` : ""}` },
        { id: "ask", name: "Ask each time" },
        ...list.map((b) => ({ id: b.id, name: b.name })),
      ];
      select.replaceChildren(
        ...options.map((o) => {
          const opt = el("option", { value: o.id }, o.name);
          if (o.id === pref || (pref !== "system" && pref !== "ask" && list.find((b) => b.id === pref && b.desktopId === o.id))) {
            opt.selected = true;
          }
          return opt;
        }),
      );
      // Keep the two the tooling is built for at the top, and mark them so the list explains itself.
      for (const opt of select.options) {
        const b = list.find((x) => x.id === opt.value);
        // Plain names in the list; the difference between the two ways of driving lives in the
        // sentence underneath, because "CDP" and "WebDriver" are our words, not the reader's.
        if (b && opt.textContent === b.name && !b.drivable) {
          opt.textContent = `${b.name} — not scriptable`;
        }
      }
      select.title = list.length
        ? `${list.length} browsers on this desktop. Chromium ones (Brave, Chrome) can be driven while you keep using them; Firefox ones (Firefox, FireDragon, Mullvad) run in their own profile instead.`
        : "No browsers were found in the desktop menu";
    };
    paint({ list: [], stock: {} });
    loadBrowserCatalogue().then(paint);
    select.addEventListener("change", async () => {
      const value = select.value;
      localStorage.setItem("quixi.externalBrowser", value);
      const cat = await loadBrowserCatalogue();
      const target = (cat.list || []).find((b) => b.id === value);
      await rpc("AppPreferences", "setPreference", ["externalBrowser", target ? (target.desktopId || value) : value]);
      toast(value === "ask" ? "Pages will ask which browser each time." : `Pages open in ${currentExternalBrowserName(cat)}.`);
      renderPage();
    });
    return select;
  }

  async function renderBrowser(host) {
    const version = ++browserRenderVersion;
    // The header names the chosen browser, so the catalogue is fetched before the copy is built.
    loadBrowserCatalogue().then((cat) => { state.browserCat = cat; });
    const data = state.browserState || (await api("/api/quixi/browser"));
    state.browserState = data;
    const selected = (data.tabs || []).find(
      (t) => t.tabId === data.selectedTabId || t.id === data.selectedTabId,
    );
    const address = el("input", {
      value: selected?.url || "",
      placeholder: "https://example.com",
      "aria-label": "Browser address",
      onKeydown: async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // This pane is not a browser. Send the page to the real one — Brave with --app, so it
          // arrives as a window of its own rather than a tab in whatever is already open.
          try {
            await openExternal(address.value.trim());
            toast("Opened in your browser");
          } catch (error) {
            toast(String(error && error.message ? error.message : error), true);
          }
        }
      },
    });
    // No iframe. A server-rendered snapshot inside a sandboxed frame is not a browser — no scripts
    // worth the name, no logins, no session — and it was wearing the chrome of one.
    const frame = el(
      "div",
      { class: "browser-handoff", id: "browser-frame" },
      el("p", {}, `Pages open in ${currentExternalBrowserName(state.browserCat)}, in their own window.`),
      el("p", { class: "muted" }, "This pane is the system webview, not a browser. Sending the page out is the only way to give you the real one."),
      el(
        "div",
        { class: "toolbar" },
        button(`Open in ${currentExternalBrowserName(state.browserCat)}`, async () => {
          const url = (address.value || selected?.url || "").trim();
          if (!url) return toast("Enter an address first", true);
          try {
            await openExternal(url);
            toast(`Opened in ${currentExternalBrowserName(state.browserCat)}`);
          } catch (error) {
            toast(String(error && error.message ? error.message : error), true);
          }
        }, "primary"),
        button("Copy address", async () => {
          await navigator.clipboard.writeText(address.value || selected?.url || "");
          toast("Address copied");
        }, "quiet"),
      ),
    );
    if (version !== browserRenderVersion || !state.browser || !host.isConnected)
      return;
    const panel = el(
      "aside",
      { class: "browser-panel" },
      el(
        "div",
        { class: "browser-head" },
        icon("browser", 16),
        el("strong", {}, "QuixiDesk Browser"),
        browserPick(),
        ib("Close browser", "close", () => {
          state.browser = false;
          panel.remove();
        }),
      ),
      el(
        "div",
        { class: "browser-tabs" },
        ...(data.tabs || []).map((t) =>
          button(
            t.title || "New tab",
            () => browserAction("select_tab", { tabId: t.tabId || t.id }),
            data.selectedTabId === (t.tabId || t.id) ? "active" : "",
          ),
        ),
        ib("New browser tab", "plus", () => browserAction("new_tab")),
      ),
      el(
        "div",
        { class: "browser-controls" },
        ib("Browser back", "back", () => browserAction("back")),
        ib("Browser forward", "arrow", () => browserAction("forward")),
        ib("Reload browser", "refresh", () => browserAction("reload")),
        button("Close tab", () => browserAction("close_tab"), "quiet"),
      ),
      el(
        "form",
        {
          class: "browser-address",
          onSubmit: (e) => {
            e.preventDefault();
            browserAction("navigate", { url: address.value }).catch((e) =>
              toast(e.message, true),
            );
          },
        },
        address,
        el("button", { type: "submit" }, "Go"),
      ),
      frame,
      el(
        "div",
        { class: "browser-status" },
        "Isolated page snapshot · remote content cannot access conversations.",
      ),
    );
    host.querySelector(".browser-panel")?.remove();
    host.append(panel);
  }
  addEventListener("message", (e) => {
    const frame = document.getElementById("browser-frame");
    if (
      !frame ||
      e.source !== frame.contentWindow ||
      e.origin !== "null" ||
      !e.data ||
      typeof e.data !== "object"
    )
      return;
    const data = e.data;
    if (data.type === "quixi-browser-click" && typeof data.ref === "string")
      browserAction("click_ref", { ref: data.ref });
    if (data.type === "quixi-browser-navigate" && typeof data.url === "string")
      browserAction("navigate", { url: data.url });
  });
  async function contextDrawer() {
    const host = document.getElementById("page-host");
    host.querySelector(".drawer")?.remove();
    const s = session();
    if (!s) return;
    const folder = s.cwd || currentFolder();
    const files = await rpc("LocalSessions", "listDirectoryAtCwd", [folder]);
    const drawer = el(
      "aside",
      { class: "drawer" },
      el(
        "div",
        { class: "row" },
        el("h3", { class: "grow" }, "Files & context"),
        ib("Close context", "close", () => drawer.remove()),
      ),
      el("p", { class: "path" }, folder),
      project()?.instructions
        ? el(
            "details",
            {},
            el("summary", {}, "Project instructions"),
            el("pre", {}, project().instructions),
          )
        : null,
    );
    for (const f of files || [])
      drawer.append(
        button(
          [icon(f.isDir || f.isDirectory ? "folder" : "file", 14), f.name],
          async () => {
            if (f.isDir || f.isDirectory) {
              const items = await rpc("LocalSessions", "listDirectoryAtCwd", [
                f.path,
              ]);
              dialog(
                f.name,
                items.map((x) => el("p", { class: "path" }, x.path)),
              );
              return;
            }
            const r = await api("/api/quixi/workspace/read", { path: f.path });
            dialog(
              f.name,
              el(
                "pre",
                { class: "code-preview" },
                ...r.contents
                  .split("\n")
                  .map((line) =>
                    el("span", { class: "code-line" }, line || " "),
                  ),
              ),
              { wide: true },
            );
          },
          "file-button",
        ),
      );
    if (!files?.length)
      drawer.append(
        el("p", { class: "muted" }, "This folder has no visible entries."),
      );
    host.append(drawer);
  }
  const refreshTimers = new Map();
  let streamFrame = null;
  function scheduleStreamRender() {
    if (streamFrame !== null) return;
    streamFrame = requestAnimationFrame(() => {
      streamFrame = null;
      if (state.page === "chat") renderTranscript();
    });
  }
  addEventListener("quixi:event", ({ detail: { channel, payload } }) => {
    if (channel === "quixi:open-tools") { navigate("tools"); return; }
    if (channel === "quixi:mcp-interaction") { pollMcpInteractions(); return; }
    if (channel === "quixi:mcp-updated") {
      if (state.page === "tools") loadTools({ poll: true });
      return;
    }
    if (channel === "quixi:browser-updated") {
      state.browserState = payload;
      if (state.browser) renderBrowser(document.getElementById("page-host"));
      return;
    }
    if (channel.includes("ScheduledTasks")) {
      Promise.all([loadSessions(), loadSchedules()]).catch(e=>toast(e.message,true));
      return;
    }
    if (channel === "quixi:artifact-preview") {
      loadArtifacts();
      return;
    }
    if (
      !payload ||
      (!channel.includes("LocalAgentModeSessions") &&
        !channel.includes("LocalSessions"))
    )
      return;
    const id = payload.sessionId;
    if (!id) return;
    const message = payload.message;
    if (message?.type === "stream_event") {
      let stream = state.streams.get(id);
      if (!stream) {
        stream = { text: "", thinking: "" };
        state.streams.set(id, stream);
      }
      const event = message.event;
      if (event?.type === "message_start") {
        stream.text = "";
        stream.thinking = "";
      }
      if (event?.delta?.type === "text_delta")
        stream.text += event.delta.text || "";
      if (event?.delta?.type === "thinking_delta")
        stream.thinking += event.delta.thinking || "";
      if (state.id === id) scheduleStreamRender();
      return;
    }
    if (message?.type === "assistant") {
      const finished = state.streams.get(id);
      speakReply(finished?.text || message?.message?.content || "");
    }
    if (
      message?.type === "assistant" ||
      payload.type === "close" ||
      payload.type === "error"
    )
      state.streams.delete(id);
    clearTimeout(refreshTimers.get(id));
    refreshTimers.set(
      id,
      setTimeout(async () => {
        try {
          await refreshSession(id);
          if (state.id === id) {
            renderTranscript();
            updateSendButton();
          }
        } catch (e) {
          toast(e.message, true);
        } finally {
          refreshTimers.delete(id);
        }
      }, 50),
    );
  });
  async function boot() {
    applyTheme();
    // The backend is the record: take its appearance before the first paint settles.
    try {
      if (adoptPreferences(await rpc("AppPreferences", "getPreferences"))) applyTheme();
    } catch {}
    await loadPersona();
    applySidebarWidth(localStorage.getItem("quixi.sidebarWidth"));
    state.permission = localStorage.getItem("quixi.permission") || "default";
    document.body.dataset.platform = /Mac/.test(navigator.platform)
      ? "macos"
      : /Win/.test(navigator.platform)
        ? "windows"
        : "linux";
    try {
      await Promise.all([loadSessions(), loadProjects(), loadProviders()]);
      // A new conversation has no implicit access to the source checkout, but it does have the
      // memory palace: that is where the things it is supposed to remember live, so opening on
      // "No folder selected" made the app look like it had forgotten where its own memory is.
      state.folder = (await palaceFolder()).path;
      const path = decodeURIComponent(location.pathname.slice(1));
      navigate(path || "new", null, { replace: true });
      pollMcpInteractions();
      if (!state.providers.hasConfiguredProvider)
        toast("Welcome. Connect a provider to start your first task.");
    } catch (e) {
      root.replaceChildren(
        el(
          "div",
          { class: "page" },
          el("h1", {}, "Unable to open the workspace"),
          el("p", { class: "error-text" }, e.message),
          button("Try again", () => boot(), "primary"),
        ),
      );
    }
  }
  addEventListener("keydown", (e) => {
    const command = e.metaKey || e.ctrlKey;
    // Ctrl+F is what people reach for. Inside a conversation it finds in that conversation; anywhere
    // else it opens the search page, because "find" and "search" are the same instinct and Ctrl+K is
    // not a thing anybody remembers. Ctrl+K still works, so nothing that used to be true stops being
    // true.
    if (command && e.key.toLowerCase() === "f") {
      e.preventDefault();
      if (state.page === "chat") openConversationFind();
      else navigate("search");
    } else if (command && e.key.toLowerCase() === "g" && conversationFind) {
      e.preventDefault(); stepConversationFind(e.shiftKey ? -1 : 1);
    } else if (command && e.key.toLowerCase() === "n") {
      e.preventDefault();
      saveDraft();state.project=null;state.folder="";navigate("new");
    } else if (command && e.key.toLowerCase() === "k") {
      e.preventDefault();
      navigate("search");
    } else if (command && e.key === ",") {
      e.preventDefault();
      navigate("settings");
    }
  });
  matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () =>
    applyTheme(),
  );
  // Refresh persisted state after returning from a background native window.
  addEventListener("focus", () => {
    if (state.sessions.length)
      loadSessions()
        .then(() => {
          if (state.page === "chat") openTranscript();
        })
        .catch(() => {});
  });
  function positionPopover(d, anchor) {
    d.classList.add("workflow-popover");
    function place() {
      const width=Math.min(450,innerWidth-32),height=d.getBoundingClientRect().height;
      d.style.left=Math.max(16,Math.min(anchor?.left ?? innerWidth/2-width/2,innerWidth-width-16))+"px";
      d.style.top=Math.max(16,Math.min(anchor?anchor.top-height-10:80,innerHeight-height-16))+"px";
    }
    place();requestAnimationFrame(place);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(place):null;
    observer?.observe(d);window.addEventListener("resize",place);
    d.addEventListener("close",()=>{observer?.disconnect();window.removeEventListener("resize",place);},{once:true});
  }
  const workflowContext={deleteSession,deleteProject,state,el,button,ib,icon,select,field,dialog,formDialog,confirmDialog,toast,api,rpc,copy,navigate,header,empty,date,currentFolder,loadSchedules,loadProjects,loadSessions,loadArtifacts,render,renderPage,saveDraft,renderChips,sessionMenu,projectEditor,manageProjectFolders,scheduleEditor,artifactThumbnail};
  const workspaceUI=window.QuixiWorkspace.create(workflowContext);
  const capabilityUI=window.QuixiCapabilityWorkflows.create({...workflowContext,plainBody,openExternal,getToolsData:()=>toolsData,reloadTools:()=>loadTools(),updateMcpConnections,advancedMcpEditor:()=>mcpEditor(),
    startSkill:async(skill,files)=>{saveDraft();navigate("new");state.attachments.push(...files.map(f=>({name:f.name||f.path||"SKILL.md",text:f.content||f.contents||""})));const input=document.getElementById("prompt");input.value=`Use the attached ${skill.name||skill.id} instructions to help me with: `+(input.value.trim()?"\n\n"+input.value:"");saveDraft();renderChips();input.focus();}});
  boot();
})();
