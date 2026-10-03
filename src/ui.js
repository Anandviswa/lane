/* =====================================================================
   UI kit: element helper, icons, components, router, render loop, chrome
   ===================================================================== */

function h(tag, a){
  const e = document.createElement(tag);
  if(a) for(const k in a){
    const v = a[k];
    if(v == null || v === false) continue;
    if(k === "class") e.className = v;
    else if(k === "style") { if(typeof v === "object") Object.assign(e.style, v); else e.style.cssText = v; }
    else if(k === "html") e.innerHTML = v;
    else if(k === "data") Object.keys(v).forEach(dk => e.dataset[dk] = v[dk]);
    else if(k.slice(0, 2) === "on") e.addEventListener(k.slice(2).toLowerCase(), v);
    else if(k === "value" || k === "checked" || k === "disabled" || k === "selected" || k === "indeterminate") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for(let i = 2; i < arguments.length; i++) add(e, arguments[i]);
  return e;
}
function add(e, c){
  if(c == null || c === false) return;
  if(Array.isArray(c)) c.forEach(x => add(e, x));
  else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
}

/* ---------- icons (inline SVG, stroke) ---------- */
const ICONS = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20"/>',
  projects:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
  tasks:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  layers:'<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  diamond:'<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  flag:'<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>',
  left:'<path d="m15 18-6-6 6-6"/>', right:'<path d="m9 18 6-6-6-6"/>', down:'<path d="m6 9 6 6 6-6"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  gantt:'<path d="M3 6h10M7 12h12M5 18h8"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  board:'<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  external:'<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  overview:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play:'<path d="M6 4l14 8-14 8z"/>',
  dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  archive:'<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
};
function icon(name, cls){
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "i" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name] || ""; return s;
}

/* ---------- components ---------- */
function avatar(u, cls){
  if(typeof u === "string") u = byId("users", u);
  if(!u) return h("span", { class:"av " + (cls || ""), style:{ background:"#C9C2D1" } }, "?");
  return h("span", { class:"av " + (cls || "") + (isCustomer(u) ? " cust" : ""), style:{ background:hashColor(u.id) }, title:u.name + (u.role ? " · " + u.role : "") }, initials(u.name));
}
function avatars(ids, cls){ return h("span", { class:"avs" }, (ids || []).slice(0, 4).map(id => avatar(id, cls || "sm"))); }
function whoRow(u, extra){
  if(typeof u === "string") u = byId("users", u);
  if(!u) return h("span", { class:"faint" }, "Unassigned");
  return h("div", { class:"who" }, avatar(u), h("div", { style:"min-width:0" }, h("div", { class:"n" }, u.name), h("div", { class:"r" }, extra || u.role || "")));
}
function acctLogo(a, cls){ if(typeof a === "string") a = byId("accounts", a); if(!a) return null;
  return h("span", { class:"acct-logo " + (cls || ""), style:{ background:a.logo_color || hashColor(a.id) } }, initials(a.name)); }
function pill(text, kind, dot){ return h("span", { class:"pill " + (kind || "") }, dot ? h("span", { class:"d" }) : null, text); }
function statusPill(s){ return pill(s, statusKind(s), true); }
function bar(pct){ return h("div", { class:"bar" }, h("i", { style:{ width:Math.max(0, Math.min(100, pct)) + "%" } })); }
function tile(v, k, kind, onclick){ return h(onclick ? "button" : "div", { class:"tile " + (kind || ""), onclick }, h("div", { class:"v" }, v), h("div", { class:"k" }, k)); }
function card(title, meta, body, opts){
  opts = opts || {};
  return h("section", { class:"card" + (opts.internal ? " internal" : "") },
    h("div", { class:"card-h" }, opts.icon ? icon(opts.icon, "sm") : null, h("h3", null, title), opts.only ? h("span", { class:"only" }, icon("lock", "xs"), opts.only) : null,
      meta != null ? h("span", { class:"meta" }, meta) : null, opts.action || null),
    h("div", { class:"card-b", style:opts.flush ? "padding:0" : null }, body));
}
function empty(t){ return h("div", { class:"empty" }, t); }
function sel(opts, value, onchange, cls){
  const s = h("select", { class:"sel " + (cls || ""), onchange:e => onchange(e.target.value) },
    opts.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return h("option", { value:v, selected:v === value }, l); }));
  s.value = value == null ? "" : value; return s;
}
function dateInp(value, onchange, attrs){ return h("input", Object.assign({ type:"date", class:"inp", value:value || "", onchange:e => onchange(e.target.value) }, attrs || {})); }
function segm(opts, value, onpick){
  return h("div", { class:"seg" }, opts.map(o => h("button", { "aria-pressed":String(o[0] === value), onclick:() => onpick(o[0]) }, o[2] ? icon(o[2], "sm") : null, o[1])));
}
/* Status circle: click cycles To do → In progress → Completed. Milestones show a diamond, Blocked a no-entry. */
function statusCircle(t, onchange){
  const cls = t.type === "MILESTONE" ? "sc ms" + (t.status === "Completed" ? " done" : "") : "sc " + statusKind(t.status);
  const b = h("button", { class:cls, title:t.status + " — click to change", "aria-label":t.status,
    onclick:e => { e.stopPropagation(); if(onchange === false) return;
      const next = t.status === "Completed" ? "To do" : t.status === "To do" ? "In progress" : "Completed";
      setTaskStatus(t, t.type === "MILESTONE" ? (t.status === "Completed" ? "To do" : "Completed") : next); commit(); } });
  if(t.type === "MILESTONE") b.appendChild(icon("diamond"));
  else if(t.status === "Blocked") b.appendChild(icon("ban"));
  else if(t.status === "Completed") b.appendChild(icon("check", "xs"));
  if(onchange === false) b.disabled = true;
  return b;
}

/* ---------- toast, popover, modal ---------- */
let toastTimer = null;
function toast(msg){ const t = $("ln-toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 3200); }

let popOwner = null;
function openPop(anchor, content){
  const p = $("ln-pop"); p.innerHTML = ""; add(p, content); p.hidden = false; popOwner = anchor;
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth;
  p.style.top = (r.bottom + 6) + "px";
  p.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
}
function closePop(){ $("ln-pop").hidden = true; popOwner = null; }
document.addEventListener("mousedown", e => { if(popOwner && !$("ln-pop").contains(e.target) && !popOwner.contains(e.target)) closePop(); });

function openModal(build, cls){
  const m = $("ln-modal"); m.innerHTML = "";
  const box = h("div", { class:"modal " + (cls || "") }); m.appendChild(box);
  const redraw = () => { box.innerHTML = ""; add(box, build(redraw, closeModal)); };
  redraw(); m.classList.add("open");
  const f = box.querySelector("input,select,textarea"); if(f) setTimeout(() => f.focus(), 30);
  return redraw;
}
function closeModal(){ $("ln-modal").classList.remove("open"); $("ln-modal").innerHTML = ""; }
$("ln-modal").addEventListener("mousedown", e => { if(e.target === $("ln-modal")) closeModal(); });
function modalHead(title, sub){ return h("div", { class:"modal-h" }, h("div", { class:"grow" }, h("h3", null, title), sub ? h("p", { class:"sub", style:"margin-top:4px" }, sub) : null),
  h("button", { class:"iconbtn", onclick:closeModal, "aria-label":"Close" }, icon("x"))); }
function confirmBox(title, text, okLabel, onOk, danger){
  openModal(() => [modalHead(title), h("div", { class:"modal-b" }, h("p", { class:"sub" }, text)),
    h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"),
      h("button", { class:"btn " + (danger ? "danger" : "primary"), onclick:() => { closeModal(); onOk(); } }, okLabel))], "narrow");
}

/* ---------- rich text (contenteditable, small toolbar, SmartFill) ---------- */
function cleanHTML(s){
  const d = document.createElement("div"); d.innerHTML = s || "";
  d.querySelectorAll("script,style,iframe,object,embed").forEach(n => n.remove());
  d.querySelectorAll("*").forEach(n => [...n.attributes].forEach(a => { if(/^on/i.test(a.name) || (a.name === "href" && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); }));
  return d.innerHTML;
}
function smartFill(html, pid){
  const p = byId("projects", pid) || {}, a = byId("accounts", p.account_id) || {}, hl = p.id ? health(p.id) : null;
  const map = { "project.name":p.name, "project.status":p.status, "project.start":fmtDY(p.start), "project.due":fmtDY(p.due),
    "project.progress":hl ? hl.pct + "%" : "", "project.owner":userName(p.owner_id), "account.name":a.name,
    "project.next_milestone":hl ? (hl.milestones.find(m => m.status !== "Completed") || {}).name || "—" : "", "today":fmtDY(todayISO()) };
  return String(html || "").replace(/\{\{([a-z_.]+)\}\}/g, (m, k) => k in map ? '<span class="sf" title="SmartFill: ' + k + '">' + esc(map[k] || "—") + "</span>" : m);
}
function richEditor(value, onSave, opts){
  opts = opts || {};
  const ed = h("div", { class:"ed rich", contenteditable:"true", "data-ph":opts.placeholder || "Write something…", html:cleanHTML(value) });
  let timer = null;
  const save = () => { clearTimeout(timer); onSave(cleanHTML(ed.innerHTML)); };
  ed.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 700); });
  ed.addEventListener("blur", save);
  const cmd = (c, v) => e => { e.preventDefault(); ed.focus(); document.execCommand(c, false, v); save(); };
  const tb = h("div", { class:"tb" },
    h("button", { onmousedown:cmd("bold"), title:"Bold" }, "B"),
    h("button", { onmousedown:cmd("italic"), title:"Italic", style:"font-style:italic" }, "I"),
    h("button", { onmousedown:cmd("insertUnorderedList"), title:"Bullets" }, icon("list", "sm")),
    h("button", { onmousedown:cmd("formatBlock", "h3"), title:"Heading" }, "H"),
    h("button", { onmousedown:cmd("formatBlock", "p"), title:"Paragraph" }, "¶"),
    opts.smartfill ? [h("span", { class:"sp" }),
      h("button", { title:"Insert a SmartFill field", style:"font-weight:500;font-size:11.5px;color:var(--violet)", onmousedown:e => {
        e.preventDefault();
        const range = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
        openPop(e.currentTarget, [h("div", { class:"pop-h" }, "SmartFill — fills from live project data"),
          ["project.name","project.status","project.start","project.due","project.progress","project.owner","project.next_milestone","account.name","today"].map(k =>
            h("button", { class:"pop-i", onclick:() => { closePop(); ed.focus(); const s = window.getSelection(); if(range){ s.removeAllRanges(); s.addRange(range); }
              document.execCommand("insertText", false, "{{" + k + "}}"); save(); } }, h("span", { class:"mono", style:"font-size:12px" }, "{{" + k + "}}")))]);
      } }, "{ } SmartFill")] : null);
  return h("div", { class:"rte" }, tb, ed);
}

/* ---------- routing ---------- */
function parseRoute(){
  const raw = location.hash.replace(/^#\/?/, ""), qi = raw.indexOf("?");
  const path = qi > -1 ? raw.slice(0, qi) : raw, qs = qi > -1 ? raw.slice(qi + 1) : "";
  const q = {}; new URLSearchParams(qs).forEach((v, k) => q[k] = v);
  return { parts:path.split("/").filter(Boolean), q, path };
}
function go(path, q){
  const qs = q ? new URLSearchParams(Object.entries(q).filter(e => e[1] != null && e[1] !== "")).toString() : "";
  location.hash = "#/" + path + (qs ? "?" + qs : "");
}
function setQ(patch){ const r = parseRoute(); go(r.path, Object.assign({}, r.q, patch)); }
function openTask(id){ setQ({ t:id }); }
function closeTaskDrawer(){ setQ({ t:null }); }

/* ---------- render loop ----------
   A re-render rebuilds the screen, which would drop focus and lose half-typed
   text. So, like Day, hold the render while a text field is focused and run
   it when the field is left. Selects, dates and checkboxes don't hold it. */
let renderQueued = false, renderHeld = false, lastPath = null;
function typing(){
  const a = document.activeElement; if(!a) return false;
  if(a.isContentEditable || a.tagName === "TEXTAREA") return true;
  return a.tagName === "INPUT" && /^(text|search|number|email|url|)$/.test(a.type || "");
}
function scheduleRender(){
  if(renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderSoon(); });
}
function renderSoon(){
  if(!typing()){ render(); return; }
  if(renderHeld) return; renderHeld = true;
  document.addEventListener("focusout", function once(){
    document.removeEventListener("focusout", once); renderHeld = false;
    setTimeout(() => { if(!typing()) render(); else renderSoon(); }, 60);
  });
}
function keepScroll(root){ const m = {}; root.querySelectorAll("[data-sk]").forEach(e => m[e.dataset.sk] = [e.scrollLeft, e.scrollTop]); return m; }
function restoreScroll(root, m){ root.querySelectorAll("[data-sk]").forEach(e => { const v = m[e.dataset.sk]; if(v){ e.scrollLeft = v[0]; e.scrollTop = v[1]; } }); }

const RAIL = [["myday","My Day","sun"],["home","Home","home"],["accounts","Accounts","building"],["projects","Projects","projects"],
              ["tasks","All tasks","tasks"],["inbox","Inbox","inbox"],["templates","Templates","layers"],["timesheets","Time","clock"]];
let crumbs = [];
function render(){
  const r = parseRoute();
  if(!r.parts.length){ go("home"); return; }
  const top = r.parts[0];
  const portal = top === "portal";
  actor = portal ? portalViewer() : null;
  $("ln-app").hidden = portal; $("ln-portal").hidden = !portal;
  if(portal){ renderPortal(r); renderDrawer(r.q.t, true); return; }

  const isDay = top === "myday";
  $("ln-main").hidden = isDay; $("ln-dayhost").hidden = !isDay;
  if(isDay){ crumbs = [["My Day"]]; mountDay(); } else {
    const main = $("ln-main"), same = lastPath === r.path;
    const sk = same ? Object.assign(keepScroll(main), { __main:[main.scrollLeft, main.scrollTop] }) : null;
    crumbs = [];
    const view = (VIEWS[top] || viewNotFound)(r);
    main.innerHTML = ""; add(main, view);
    if(sk){ restoreScroll(main, sk); main.scrollLeft = sk.__main[0]; main.scrollTop = sk.__main[1]; } else main.scrollTop = 0;
  }
  lastPath = r.path;
  renderChrome(r);
  renderDrawer(r.q.t, false);
  if(isDay) dayRefresh();
}
function viewNotFound(){ return h("div", { class:"page" }, empty("Nothing here. Pick something from the left.")); }

function renderChrome(r){
  r = r || parseRoute();
  const top = r.parts[0];
  const rl = $("ln-raillinks"); rl.innerHTML = "";
  RAIL.forEach(x => rl.appendChild(h("a", { class:"rl-a", href:"#/" + x[0], "aria-current":top === x[0] ? "page" : null }, icon(x[2]), x[1])));
  const rs = $("ln-railsettings"); rs.innerHTML = ""; add(rs, [icon("gear"), "Settings"]);
  if(top === "settings") rs.setAttribute("aria-current", "page"); else rs.removeAttribute("aria-current");

  const c = $("ln-crumbs"); c.innerHTML = "";
  const cr = crumbs.length ? crumbs : [[(RAIL.find(x => x[0] === top) || [0, "Settings"])[1]]];
  cr.forEach((x, i) => {
    if(i) c.appendChild(h("span", { class:"sep" }, "/"));
    c.appendChild(i === cr.length - 1 || !x[1] ? h("span", { class:"cur" }, x[0]) : h("a", { href:x[1] }, x[0]));
  });
  const si = $("ln-searchic"); if(!si.firstChild) si.appendChild(icon("search", "sm"));

  const va = $("ln-viewas"); va.innerHTML = ""; add(va, [icon("eye", "sm"), "View as customer"]);
  const bell = $("ln-bell"); bell.innerHTML = ""; bell.appendChild(icon("bell"));
  const unread = rows("notifications", n => n.user_id === me().id && !n.read).length;
  if(unread) bell.appendChild(h("span", { class:"badge-n" }, unread));
  const mb = $("ln-me"); mb.innerHTML = ""; mb.appendChild(avatar(me(), "lg"));
}

/* ---------- top bar wiring ---------- */
$("ln-bell").addEventListener("click", e => {
  const mine = rows("notifications", n => n.user_id === me().id).sort(by(n => n.at)).reverse().slice(0, 30);
  openPop(e.currentTarget, [
    h("div", { class:"split", style:"padding:4px 6px 2px" }, h("div", { class:"pop-h grow", style:"padding-left:4px" }, "Notifications"),
      h("button", { class:"link", onclick:() => { mine.forEach(n => update("notifications", n.id, { read:true })); commit(); closePop(); } }, "Mark all read")),
    mine.length ? mine.map(n => h("button", { class:"pop-i" + (n.read ? "" : " unread"), onclick:() => { update("notifications", n.id, { read:true }); commit(); closePop(); if(n.link) location.hash = n.link.slice(1); } },
      icon("bell", "sm"), h("div", { class:"grow" }, n.text, h("small", null, fmtAgo(n.at))))) : empty("You're all caught up.")
  ]);
});
$("ln-me").addEventListener("click", e => {
  openPop(e.currentTarget, [h("div", { class:"pop-h" }, "Act as (demo)"),
    rows("users", u => u.type === "TEAM").map(u => h("button", { class:"pop-i", onclick:() => { session.user = u.id; saveSession(); closePop(); commit(); toast("Now acting as " + u.name); } },
      avatar(u, "sm"), h("div", { class:"grow" }, u.name, h("small", null, u.role)), u.id === me().id ? icon("check", "sm") : null)),
    h("div", { class:"hr", style:"margin:6px 0" }),
    h("div", { class:"pop-i", style:"cursor:default" }, h("div", { class:"grow" }, h("small", null, "Signed in as " + me().name + ". There's no login in this prototype — switch people here to see their view.")))]);
});
$("ln-viewas").addEventListener("click", e => {
  const r = parseRoute(), cur = r.parts[0] === "projects" && r.parts[1];
  const ps = rows("projects", p => !p.archived && (p.customer_ids || []).length);
  openPop(e.currentTarget, [h("div", { class:"pop-h" }, "Open the customer portal for…"),
    ps.map(p => h("button", { class:"pop-i", onclick:() => { closePop(); go("portal/" + p.id + "/home"); } }, acctLogo(p.account_id),
      h("div", { class:"grow" }, p.name, h("small", null, (byId("accounts", p.account_id) || {}).name + (p.id === cur ? " · this project" : ""))))) ]);
});
let searchTimer = null;
$("ln-search").addEventListener("input", e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target), 120); });
$("ln-search").addEventListener("keydown", e => { if(e.key === "Escape"){ e.target.value = ""; closePop(); e.target.blur(); } });
function runSearch(inp){
  const q = inp.value.trim().toLowerCase(); if(q.length < 2){ closePop(); return; }
  const hit = s => String(s || "").toLowerCase().indexOf(q) > -1;
  const ps = rows("projects", p => hit(p.name) || hit((byId("accounts", p.account_id) || {}).name)).slice(0, 5);
  const as = rows("accounts", a => a.kind !== "vendor" && hit(a.name)).slice(0, 4);
  const ts = rows("tasks", t => hit(t.name)).slice(0, 8);
  const res = [];
  if(ps.length) res.push(h("div", { class:"pop-h" }, "Projects"), ps.map(p => h("button", { class:"pop-i", onclick:() => { closePop(); inp.value = ""; go("projects/" + p.id + "/overview"); } }, icon("projects", "sm"), h("div", { class:"grow" }, p.name, h("small", null, (byId("accounts", p.account_id) || {}).name)))));
  if(as.length) res.push(h("div", { class:"pop-h" }, "Accounts"), as.map(a => h("button", { class:"pop-i", onclick:() => { closePop(); inp.value = ""; go("accounts/" + a.id); } }, icon("building", "sm"), h("div", { class:"grow" }, a.name))));
  if(ts.length) res.push(h("div", { class:"pop-h" }, "Tasks"), ts.map(t => h("button", { class:"pop-i", onclick:() => { closePop(); inp.value = ""; go("projects/" + t.project_id + "/plan", { t:t.id }); } }, icon("tasks", "sm"),
    h("div", { class:"grow" }, t.name, h("small", null, (byId("projects", t.project_id) || {}).name + " · " + t.status)))));
  openPop(inp, res.length ? res : empty("No matches for “" + inp.value + "”"));
}
document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    if($("ln-modal").classList.contains("open")) closeModal();
    else if(!$("ln-pop").hidden) closePop();
    else if(parseRoute().q.t) closeTaskDrawer();
  }
  if(e.key === "/" && !typing() && document.activeElement !== $("ln-search") && !$("ln-app").hidden){ e.preventDefault(); $("ln-search").focus(); }
});
$("ln-scrim").addEventListener("click", closeTaskDrawer);
