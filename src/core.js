"use strict";
/* =====================================================================
   Lane — core: helpers, store, sync, domain rules
   ===================================================================== */

const LS_DB = "lane.db.v1", LS_SESSION = "lane.session.v1", LS_DIRTY = "lane.dirty.v1", LS_CFG = "lane.cfg.v1";

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
function read(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; } }
function write(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ console.warn("storage full?", e); } }
function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function nowISO(){ return new Date().toISOString(); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
function plural(n, w, ws){ return n + " " + (n === 1 ? w : (ws || w + "s")); }
function by(f){ return (a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; }; }
function uniq(a){ return Array.from(new Set(a)); }

/* ---------- dates (ISO yyyy-mm-dd strings, local) ---------- */
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function pad(n){ return n < 10 ? "0" + n : "" + n; }
function iso(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseISO(s){ const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function todayISO(){ return iso(new Date()); }
function addDays(s, n){ const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b){ return Math.round((parseISO(b) - parseISO(a)) / 864e5); }   // b − a
function minD(a, b){ return !a ? b : !b ? a : (a < b ? a : b); }
function maxD(a, b){ return !a ? b : !b ? a : (a > b ? a : b); }
function weekStart(s){ const d = parseISO(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); }
function fmtD(s){ if(!s) return "—"; const d = parseISO(s); return MON[d.getMonth()] + " " + d.getDate(); }
function fmtDY(s){ if(!s) return "—"; const d = parseISO(s); return MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
function fmtRange(a, b){ if(!a && !b) return "No dates"; if(a === b) return fmtD(a); return fmtD(a) + " – " + fmtD(b); }
function fmtAgo(ts){
  if(!ts) return "";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if(s < 60) return "just now";
  if(s < 3600) return Math.floor(s / 60) + "m ago";
  if(s < 86400) return Math.floor(s / 3600) + "h ago";
  const d = Math.floor(s / 86400);
  if(d < 7) return d + "d ago";
  return fmtD(iso(new Date(ts)));
}
function dueLabel(due, done){
  if(!due) return { text:"No date", late:false };
  const T = todayISO(), n = diffDays(T, due);
  if(done) return { text:fmtD(due), late:false };
  if(n < 0) return { text:(-n) + "d overdue", late:true };
  if(n === 0) return { text:"Today", late:false };
  if(n === 1) return { text:"Tomorrow", late:false };
  return { text:fmtD(due), late:false };
}
function fmtMins(m){ m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h + ":" + pad(r); }
function parseHours(v){
  v = String(v || "").trim(); if(!v) return 0;
  if(v.indexOf(":") > -1){ const p = v.split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  const n = parseFloat(v.replace(",", ".")); return isFinite(n) ? Math.round(n * 60) : 0;
}

/* ---------- store ----------
   Every collection is a flat array of records with an id and updated_at.
   Each collection becomes one Google Sheet tab in Phase 2; each field one
   column. Deletes are tombstones (deleted:true) so a sync can carry them. */
const COLLS = ["accounts","users","projects","phases","tasks","deps","approvals","messages","files","updates",
               "templates","time_entries","activity","notifications"];
const PREFIX = { accounts:"ac", users:"u", projects:"p", phases:"ph", tasks:"t", deps:"dp", approvals:"ap", messages:"m",
                 files:"f", updates:"up", templates:"tp", time_entries:"te", activity:"av", notifications:"n" };
let db = null;

function blankDb(){ const o = { meta:{ version:1, created_at:nowISO() } }; COLLS.forEach(c => o[c] = []); return o; }
function loadDb(){ const d = read(LS_DB, null); if(!d) return null; COLLS.forEach(c => d[c] = d[c] || []); return d; }
function saveDb(){ write(LS_DB, db); }
function rows(c, f){ return db[c].filter(r => !r.deleted && (!f || f(r))); }
function byId(c, id){ if(!id) return null; for(const r of db[c]) if(r.id === id) return r.deleted ? null : r; return null; }
function insert(c, rec){
  rec.id = rec.id || uid(PREFIX[c]);
  rec.created_at = rec.created_at || nowISO();
  rec.updated_at = nowISO();
  db[c].push(rec); markDirty(c, rec.id); return rec;
}
function update(c, id, patch){
  const r = byId(c, id); if(!r) return null;
  let changed = false;
  for(const k in patch){ if(JSON.stringify(r[k]) !== JSON.stringify(patch[k])){ r[k] = patch[k]; changed = true; } }
  if(changed){ r.updated_at = nowISO(); markDirty(c, id); }
  return r;
}
function remove(c, id){
  const r = db[c].find(x => x.id === id);
  if(r && !r.deleted){ r.deleted = true; r.updated_at = nowISO(); markDirty(c, id); }
}
/* Every mutation path ends here: persist, then redraw what's on screen. */
function commit(){ saveDb(); if(typeof scheduleRender === "function") scheduleRender(); }

/* ---------- sync (Phase 2) ----------
   Day's pattern, generalised from date keys to "collection:id" keys.
   Off until an Apps Script /exec URL and secret are saved in Settings. */
let cfg = Object.assign({ url:"", token:"", lastPull:"" }, read(LS_CFG, {}));
let syncTimer = null, syncing = false, syncState = { kind:"", text:"Saved on this device" };
function saveCfg(){ write(LS_CFG, cfg); }
function syncConfigured(){ return !!(cfg.url && cfg.token); }
function markDirty(c, id){
  const q = read(LS_DIRTY, []), k = c + ":" + id;
  if(q.indexOf(k) === -1){ q.push(k); write(LS_DIRTY, q); }
  queueSync();
}
function queueSync(){
  if(!syncConfigured()) return;
  syncState = { kind:"warn", text:"Saved here · syncing…" };
  clearTimeout(syncTimer); syncTimer = setTimeout(sync, 1500);
}
function stampOf(k){ const i = k.indexOf(":"), r = db[k.slice(0, i)] && db[k.slice(0, i)].find(x => x.id === k.slice(i + 1)); return r ? r.updated_at || "" : ""; }
function sync(){
  if(!syncConfigured() || syncing) return;
  if(!navigator.onLine){ syncState = { kind:"warn", text:"Offline · saved on this device" }; return; }
  const q = read(LS_DIRTY, []);
  if(!q.length){ pull(); return; }
  syncing = true;
  const payload = { token:cfg.token, action:"save", rows:{} }, sent = {};
  q.forEach(k => {
    const i = k.indexOf(":"), c = k.slice(0, i), id = k.slice(i + 1);
    const r = db[c] && db[c].find(x => x.id === id); if(!r) return;
    (payload.rows[c] = payload.rows[c] || []).push(r); sent[k] = r.updated_at || "";
  });
  fetch(cfg.url, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify(payload) })
    .then(r => r.json())
    .then(res => {
      syncing = false;
      if(!res || !res.ok) throw new Error(res && res.error || "rejected");
      /* Anything edited while the request was in flight stays dirty. */
      write(LS_DIRTY, read(LS_DIRTY, []).filter(k => !(k in sent) || stampOf(k) !== sent[k]));
      syncState = { kind:"ok", text:"Synced " + new Date().toTimeString().slice(0, 5) };
      if(typeof renderChrome === "function") renderChrome();
    })
    .catch(e => { syncing = false; syncState = { kind:"warn", text:"Couldn't sync · saved here" }; console.warn("push failed", e); });
}
function pull(){
  if(!syncConfigured()) return;
  const u = cfg.url + "?action=all&token=" + encodeURIComponent(cfg.token) + (cfg.lastPull ? "&since=" + encodeURIComponent(cfg.lastPull) : "");
  fetch(u).then(r => r.json()).then(res => {
    if(!res || !res.ok) throw new Error(res && res.error || "rejected");
    const dirty = read(LS_DIRTY, []);
    Object.keys(res.rows || {}).forEach(c => {
      if(!db[c]) return;
      res.rows[c].forEach(srv => {
        if(dirty.indexOf(c + ":" + srv.id) > -1) return;   // local edit wins until it is pushed
        const i = db[c].findIndex(x => x.id === srv.id);
        if(i === -1) db[c].push(srv);
        else if((srv.updated_at || "") >= (db[c][i].updated_at || "")) db[c][i] = srv;
      });
    });
    cfg.lastPull = res.now || nowISO(); saveCfg(); saveDb();
    syncState = { kind:"ok", text:"Synced " + new Date().toTimeString().slice(0, 5) };
    if(typeof scheduleRender === "function") scheduleRender();
  }).catch(e => { syncState = { kind:"warn", text:"Couldn't reach the sheet" }; console.warn("pull failed", e); });
}

/* ---------- session ---------- */
let session = Object.assign({ user:"", portalAs:{} }, read(LS_SESSION, {}));
function saveSession(){ write(LS_SESSION, session); }
/* In the customer portal, "me" is the customer being previewed, so every
   action taken there is recorded against them, not the team member. */
let actor = null;
function me(){ return actor || byId("users", session.user) || rows("users", u => u.type === "TEAM")[0]; }

/* ---------- people ---------- */
const AV_COLORS = ["#2E8F6C","#3D63B0","#7457A6","#A8700F","#B4483F","#2F7F8F","#8A5A9E","#5C7A2E"];
function hashColor(s){ let h = 0; for(const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return AV_COLORS[Math.abs(h) % AV_COLORS.length]; }
function initials(n){ return String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(""); }
function userName(id){ const u = byId("users", id); return u ? u.name : "Someone"; }
function firstName(id){ return userName(id).split(" ")[0]; }
function isCustomer(u){ return u && u.type === "CUSTOMER"; }
function projectPeople(p){ return uniq([p.owner_id].concat(p.team_ids || [], p.customer_ids || [])).map(id => byId("users", id)).filter(Boolean); }

/* ---------- visibility: the one rule every screen uses ----------
   Team members see everything. A customer sees only their own projects, and
   never anything private — a private phase hides every task in it. */
function visibleTo(user, coll, rec){
  if(!user || user.type !== "CUSTOMER") return true;
  if(!rec) return false;
  const pid = coll === "projects" ? rec.id : rec.project_id || (rec.task_id && (byId("tasks", rec.task_id) || {}).project_id);
  const p = byId("projects", pid);
  if(!p || (p.customer_ids || []).indexOf(user.id) === -1) return false;
  if(coll === "projects") return true;
  if(rec.private) return false;
  if(coll === "tasks"){
    const ph = byId("phases", rec.phase_id); if(ph && ph.private) return false;
    if(rec.parent_id){ const par = byId("tasks", rec.parent_id); if(par && !visibleTo(user, "tasks", par)) return false; }
  }
  if(coll === "messages" && rec.thread === "private") return false;
  if(coll === "approvals"){ const t = byId("tasks", rec.task_id); return !!t && visibleTo(user, "tasks", t); }
  return true;
}

/* ---------- activity + notifications ---------- */
function logAct(pid, taskId, text, who){
  insert("activity", { project_id:pid, task_id:taskId || "", user_id:(who || me()).id, text, at:nowISO() });
}
function notify(userId, text, link){
  if(!userId || (me() && userId === me().id)) return;
  insert("notifications", { user_id:userId, text, link:link || "", read:false, at:nowISO() });
}

/* ---------- tasks & plan rules ---------- */
const TASK_STATUSES = ["To do","In progress","Blocked","Completed"];
const PROJECT_STATUSES = ["Proposed","In progress","On hold","Blocked","Completed"];
function statusKind(s){ return { "To do":"todo", "In progress":"prog", "Completed":"done", "Blocked":"blocked", "On hold":"hold", "Proposed":"prop" }[s] || "todo"; }
function projTasks(pid, f){ return rows("tasks", t => t.project_id === pid && !t.parent_id && (!f || f(t))); }
function subtasks(tid){ return rows("tasks", t => t.parent_id === tid).sort(by(t => t.created_at)); }
function phaseTasks(phid){ return rows("tasks", t => t.phase_id === phid && !t.parent_id).sort(by(t => (t.start || "9") + (t.type === "MILESTONE" ? "1" : "0") + t.name)); }
function projPhases(pid){ return rows("phases", p => p.project_id === pid).sort(by(p => (p.start || "9999") + pad(p.order || 0))); }
function isOverdue(t){ return t.status !== "Completed" && t.due && t.due < todayISO(); }

function setTaskStatus(t, st){
  const prev = t.status; if(prev === st) return;
  const T = todayISO(), patch = { status:st };
  /* Actual dates are stamped when the change is written; they can't be backdated. */
  if(st === "In progress" && !t.start_actual) patch.start_actual = T;
  if(st === "Completed"){ patch.due_actual = T; if(!t.start_actual) patch.start_actual = T; }
  if(prev === "Completed" && st !== "Completed") patch.due_actual = "";
  update("tasks", t.id, patch);
  logAct(t.project_id, t.id, "moved “" + t.name + "” from " + prev + " to " + st);
  if(st === "Completed" || prev === "Completed") (t.follower_ids || []).concat(t.assignee_ids || []).forEach(u =>
    notify(u, firstName(me().id) + " marked “" + t.name + "” " + st.toLowerCase(), "#/projects/" + t.project_id + "/plan?t=" + t.id));
  recalcPhase(t.phase_id);
}
function setTaskDates(t, start, due){
  if(t.type === "MILESTONE"){ start = due || start; due = start; }
  if(start && due && due < start) due = start;
  update("tasks", t.id, { start:start || "", due:due || "" });
  const moved = cascadeFrom(t.id);
  recalcPhase(t.phase_id);
  return moved;
}
/* A dependent task starts the day after its latest blocker ends and keeps its
   duration. Only linked tasks move; work with no link is never touched. Dates
   only ever move later — removing a blocker leaves them where they landed. */
function applyDeps(taskId, moved, seen){
  seen = seen || {}; moved = moved || [];
  if(seen[taskId]) return moved; seen[taskId] = 1;
  const t = byId("tasks", taskId); if(!t) return moved;
  let latest = "";
  rows("deps", d => d.task_id === taskId).forEach(d => { const b = byId("tasks", d.blocked_by_id); if(b) latest = maxD(latest, b.due); });
  if(latest && t.start && t.start <= latest){
    const dur = t.due ? diffDays(t.start, t.due) : 0, ns = addDays(latest, 1);
    update("tasks", t.id, { start:ns, due:addDays(ns, dur) });
    moved.push(t); recalcPhase(t.phase_id);
  }
  rows("deps", d => d.blocked_by_id === taskId).forEach(d => applyDeps(d.task_id, moved, seen));
  return moved;
}
function cascadeFrom(taskId){
  const moved = [];
  rows("deps", d => d.blocked_by_id === taskId).forEach(d => applyDeps(d.task_id, moved));
  return moved;
}
function wouldCycle(taskId, blockerId){
  if(taskId === blockerId) return true;
  const stack = [blockerId], seen = {};
  while(stack.length){
    const x = stack.pop(); if(x === taskId) return true; if(seen[x]) continue; seen[x] = 1;
    rows("deps", d => d.task_id === x).forEach(d => stack.push(d.blocked_by_id));
  }
  return false;
}
function addDep(taskId, blockerId){
  if(wouldCycle(taskId, blockerId)) return { error:"That would make a loop — the blocker already waits on this task." };
  if(rows("deps", d => d.task_id === taskId && d.blocked_by_id === blockerId).length) return { error:"Already linked." };
  insert("deps", { task_id:taskId, blocked_by_id:blockerId, project_id:(byId("tasks", taskId) || {}).project_id });
  const t = byId("tasks", taskId), b = byId("tasks", blockerId);
  logAct(t.project_id, t.id, "made “" + t.name + "” wait on “" + b.name + "”");
  return { moved:applyDeps(taskId) };
}
/* A phase stretches to contain its tasks; its status follows them. */
function recalcPhase(phid){
  const ph = byId("phases", phid); if(!ph) return;
  const ts = phaseTasks(phid); if(!ts.length) return;
  let s = "", e = "";
  ts.forEach(t => { s = minD(s, t.start || t.due); e = maxD(e, t.due || t.start); });
  const done = ts.filter(t => t.status === "Completed").length;
  const st = done === ts.length ? "Completed" : ts.some(t => t.status !== "To do") ? "In progress" : "To do";
  update("phases", phid, { start:s, due:e, status:st });
}
function recalcProject(pid){
  projPhases(pid).forEach(ph => recalcPhase(ph.id));
  let s = "", e = "";
  projPhases(pid).forEach(ph => { s = minD(s, ph.start); e = maxD(e, ph.due); });
  const p = byId("projects", pid);
  if(p && s) update("projects", pid, { start:minD(p.start, s), due:maxD(p.due, e) });
}

function health(pid){
  const ts = projTasks(pid), T = todayISO(), p = byId("projects", pid);
  const done = ts.filter(t => t.status === "Completed");
  const overdue = ts.filter(isOverdue);
  const atRisk = ts.filter(t => t.at_risk && t.status !== "Completed");
  const blocked = ts.filter(t => t.status === "Blocked");
  const tids = {}; ts.forEach(t => tids[t.id] = 1);
  const pending = rows("approvals", a => a.status === "REQUESTED" && tids[a.task_id]);
  const pct = ts.length ? Math.round(done.length / ts.length * 100) : 0;
  let inferred = "No tasks";
  if(ts.length){
    if(p && p.status === "Completed") inferred = "Completed";
    else if(overdue.length) inferred = "Running late";
    else {
      const span = p && p.start && p.due ? Math.max(1, diffDays(p.start, p.due)) : 0;
      const exp = span ? Math.max(0, Math.min(100, diffDays(p.start, T) / span * 100)) : 0;
      inferred = pct > exp + 10 ? "Ahead of time" : "On track";
    }
  }
  return { tasks:ts, done, overdue, atRisk, blocked, pending, pct, inferred,
           milestones:ts.filter(t => t.type === "MILESTONE").sort(by(t => t.due || "")) };
}

/* ---------- templates ----------
   Saving a project as a template turns dates into day offsets from the
   project start and people into roles. Creating from one does the reverse. */
function roleOf(uid){ const u = byId("users", uid); return !u ? "" : u.type === "CUSTOMER" ? "Customer" : (u.role || "Team member"); }
function saveAsTemplate(pid, name){
  const p = byId("projects", pid), base = p.start || todayISO();
  const keyOf = {};
  const phases = projPhases(pid).map((ph, i) => ({
    key:"ph" + i, name:ph.name, private:!!ph.private,
    tasks:phaseTasks(ph.id).map((t, j) => {
      const k = "k" + i + "_" + j; keyOf[t.id] = k;
      return { key:k, name:t.name, type:t.type, private:!!t.private, description:t.description || "",
               start_offset:t.start ? diffDays(base, t.start) : 0, duration:t.start && t.due ? diffDays(t.start, t.due) : 0,
               effort_h:Math.round((t.effort_min || 0) / 60), role:roleOf((t.assignee_ids || [])[0]) };
    })
  }));
  const deps = rows("deps", d => d.project_id === pid && keyOf[d.task_id] && keyOf[d.blocked_by_id]).map(d => [keyOf[d.task_id], keyOf[d.blocked_by_id]]);
  return insert("templates", { name:name || p.name + " template", category:"Project", description:"Saved from " + p.name, phases, deps, source_project_id:pid });
}
function templateRoles(tpl){ return uniq(tpl.phases.flatMap(ph => ph.tasks.map(t => t.role)).filter(Boolean)); }
function templateSpan(tpl){ let e = 0; tpl.phases.forEach(ph => ph.tasks.forEach(t => e = Math.max(e, (t.start_offset || 0) + (t.duration || 0)))); return e; }
function instantiateTemplate(tpl, pid, start, roleMap, namePrefix){
  const keyToId = {};
  const order0 = projPhases(pid).length;
  tpl.phases.forEach((tph, i) => {
    const ph = insert("phases", { project_id:pid, name:(namePrefix || "") + tph.name, order:order0 + i, private:!!tph.private, status:"To do", start:"", due:"" });
    tph.tasks.forEach(tt => {
      const s = addDays(start, tt.start_offset || 0), who = roleMap[tt.role];
      const t = insert("tasks", { project_id:pid, phase_id:ph.id, parent_id:"", name:tt.name, description:tt.description || "",
        type:tt.type || "TASK", status:"To do", priority:"", at_risk:false, start:s, due:addDays(s, tt.duration || 0),
        start_actual:"", due_actual:"", assignee_ids:who ? [who] : [], follower_ids:[], effort_min:(tt.effort_h || 0) * 60,
        private:!!tt.private, csat_enabled:false });
      keyToId[tt.key] = t.id;
    });
  });
  (tpl.deps || []).forEach(d => { if(keyToId[d[0]] && keyToId[d[1]]) insert("deps", { task_id:keyToId[d[0]], blocked_by_id:keyToId[d[1]], project_id:pid }); });
  Object.values(keyToId).forEach(id => applyDeps(id));
  recalcProject(pid);
  return Object.keys(keyToId).length;
}

/* ---------- time ---------- */
function myEntries(uid, from, to){ return rows("time_entries", e => e.user_id === uid && e.date >= from && e.date <= to); }
function logTime(taskId, date, minutes, notes, billable){
  const t = byId("tasks", taskId); if(!t || !minutes) return null;
  const ex = rows("time_entries", e => e.user_id === me().id && e.task_id === taskId && e.date === date && e.status === "NOT_SUBMITTED")[0];
  if(ex){ update("time_entries", ex.id, { minutes:(ex.minutes || 0) + minutes, notes:[ex.notes, notes].filter(Boolean).join(" · ") }); return ex; }
  return insert("time_entries", { user_id:me().id, date, minutes, project_id:t.project_id, task_id:taskId, billable:billable !== false,
                                  notes:notes || "", status:"NOT_SUBMITTED" });
}
