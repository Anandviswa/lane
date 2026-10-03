// What each Orbit tool does. Reads come from the local copy of the Sheet;
// writes run the app's own rules (engine.js) and save only what changed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as client from "./client.js";
import { createEngine } from "./engine.js";

const engine = createEngine("u-claude");

async function view(){ engine.load(await client.all()); return engine.ctx; }
async function mutate(fn){
  engine.load(await client.all({ fresh: true }));
  const result = fn(engine.ctx);
  const saved = await client.save(engine.dirty());
  engine.clearDirty();
  if(saved.skipped) result.warning = saved.skipped + " record(s) were not saved because someone changed them more recently. Read again and retry.";
  return result;
}

/* ---------- small helpers ---------- */
function who(c, v){
  if(!v) return "";
  const s = String(v).trim().toLowerCase();
  if(s === "me" || s === "anand" || s === "you") return "u-anand";
  if(s === "claude" || s === "agent") return "u-claude";
  if(c.byId("users", v)) return v;
  const u = c.rows("users", x => String(x.name || "").toLowerCase() === s || String(x.name || "").toLowerCase().split(" ")[0] === s)[0];
  if(!u) throw new Error("No person called " + v + " in Orbit");
  return u.id;
}
function findProject(c, ref){
  if(!ref) throw new Error("Which project? Pass project (an id like p…, or its name).");
  const p = c.byId("projects", ref) || c.rows("projects", x => String(x.name).toLowerCase() === String(ref).toLowerCase())[0]
    || c.rows("projects", x => String(x.name).toLowerCase().includes(String(ref).toLowerCase()))[0];
  if(!p) throw new Error("No project matching " + ref);
  return p;
}
function findTask(c, ref){
  const t = c.byId("tasks", ref);
  if(!t) throw new Error("No task " + ref + " (use the task id from orbit_get_project)");
  return t;
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined && o[k] !== "" && !(Array.isArray(o[k]) && !o[k].length)).map(k => [k, o[k]]));
function taskLine(c, t){
  const blockers = c.rows("deps", d => d.task_id === t.id).map(d => d.blocked_by_id);
  return { ...pick(t, ["id", "name", "status", "type", "start", "due", "doer", "kind", "autonomy", "app_ref", "priority", "session_ref", "source_ref"]),
    ...(t.at_risk ? { at_risk: true } : {}), ...(t.private ? { private: true } : {}),
    ...(c.isOverdue(t) ? { overdue: true } : {}),
    assignees: (t.assignee_ids || []).map(c.userName),
    ...(blockers.length ? { waits_on: blockers } : {}),
    ...(t.agent_brief ? { agent_brief: t.agent_brief } : {}) };
}

/* ---------- reads ---------- */
export async function today(){
  const c = await view(), T = c.todayISO(), out = { today: T, projects: {} };
  const bucket = pid => {
    const p = c.byId("projects", pid) || { name: "(no project)" };
    return out.projects[pid] = out.projects[pid] || { project: p.name, project_id: pid, due_or_overdue: [], in_progress: [], for_claude: [], approvals_waiting_on_you: [] };
  };
  c.rows("tasks", t => t.status !== "Completed" && !t.parent_id).forEach(t => {
    const p = c.byId("projects", t.project_id); if(p && p.archived) return;
    if(t.doer === "claude" && t.status !== "Blocked") bucket(t.project_id).for_claude.push(taskLine(c, t));
    else if(t.due && t.due <= T) bucket(t.project_id).due_or_overdue.push(taskLine(c, t));
    else if(t.status === "In progress") bucket(t.project_id).in_progress.push(taskLine(c, t));
  });
  c.rows("approvals", a => a.status === "REQUESTED" && (a.approver_ids || []).includes("u-anand")).forEach(a => {
    const t = c.byId("tasks", a.task_id) || {};
    bucket(a.project_id || t.project_id).approvals_waiting_on_you.push({ approval_id: a.id, task: t.name, task_id: a.task_id, note: a.note, due: a.due });
  });
  const unprocessed = c.rows("sources", s => !s.processed_at).length;
  if(unprocessed) out.unprocessed_mail_and_transcripts = unprocessed;
  return out;
}

export async function listProjects({ include_archived = false } = {}){
  const c = await view();
  return c.rows("projects", p => include_archived || !p.archived).map(p => {
    const h = c.health(p.id), a = c.byId("accounts", p.account_id) || {};
    return { id: p.id, name: p.name, account: a.name, status: p.status, start: p.start, due: p.due, progress_pct: h.pct, health: h.inferred,
      open_tasks: h.tasks.length - h.done.length, overdue: h.overdue.length, blocked: h.blocked.length, approvals_pending: h.pending.length };
  });
}

export async function getProject({ project }){
  const c = await view(), p = findProject(c, project), a = c.byId("accounts", p.account_id) || {}, h = c.health(p.id);
  return {
    project: { ...pick(p, ["id", "name", "status", "start", "due", "start_actual", "due_actual", "portal_welcome"]), account: a.name, account_id: a.id, domain: a.domain,
      owner: c.userName(p.owner_id), team: (p.team_ids || []).map(c.userName), customers: (p.customer_ids || []).map(c.userName) },
    health: { progress_pct: h.pct, status: h.inferred, overdue: h.overdue.length, at_risk: h.atRisk.length, blocked: h.blocked.length, approvals_pending: h.pending.length },
    phases: c.projPhases(p.id).map(ph => ({ ...pick(ph, ["id", "name", "status", "start", "due"]), ...(ph.private ? { private: true } : {}),
      tasks: c.phaseTasks(ph.id).map(t => taskLine(c, t)) })),
    approvals: c.rows("approvals", x => x.project_id === p.id && x.status === "REQUESTED").map(x => ({ id: x.id, task_id: x.task_id, task: (c.byId("tasks", x.task_id) || {}).name,
      approvers: (x.approver_ids || []).map(c.userName), note: x.note, due: x.due, type: x.type })),
    decisions: c.rows("decisions", d => d.project_id === p.id).sort(c.by(d => d.at || "")).map(d => pick(d, ["id", "text", "decided_by", "at", "source", "source_ref", "status"])),
    updates: c.rows("updates", u => u.project_id === p.id).sort(c.by(u => u.at || "")).slice(-5).map(u => ({ at: u.at, by: c.userName(u.author_id), private: !!u.private, body: u.body })),
    files: c.rows("files", f => f.project_id === p.id).map(f => pick(f, ["id", "name", "kind", "url", "at"])),
    recent_activity: c.rows("activity", x => x.project_id === p.id).sort(c.by(x => x.at || "")).slice(-12).map(x => x.at.slice(0, 16) + " " + c.userName(x.user_id) + " " + x.text),
    sources: c.rows("sources", s => s.project_id === p.id).sort(c.by(s => s.occurred_at || "")).slice(-10).map(s => pick(s, ["id", "kind", "occurred_at", "direction", "from", "subject", "summary", "processed_at"])),
  };
}

export async function query({ collection, project, status, doer, since, until, where, fields, limit = 200, include_deleted = false }){
  const c = await view();
  if(!c.COLLS.includes(collection)) throw new Error("Unknown collection " + collection + ". One of: " + c.COLLS.join(", "));
  const pid = project ? findProject(c, project).id : "";
  let list = ((await client.all())[collection] || []).filter(r => include_deleted || !r.deleted);
  if(pid) list = list.filter(r => r.project_id === pid || (collection === "projects" && r.id === pid));
  if(status) list = list.filter(r => String(r.status || "").toLowerCase() === String(status).toLowerCase());
  if(doer) list = list.filter(r => r.doer === doer);
  const dateOf = r => r.at || r.date || r.due || r.occurred_at || r.updated_at || "";
  if(since) list = list.filter(r => dateOf(r) >= since);
  if(until) list = list.filter(r => dateOf(r) <= until);
  if(where) for(const [k, v] of Object.entries(where)) list = list.filter(r => JSON.stringify(r[k]) === JSON.stringify(v) || String(r[k]) === String(v));
  const total = list.length;
  list = list.slice(0, limit);
  if(fields && fields.length) list = list.map(r => pick(r, ["id"].concat(fields)));
  return { collection, total, returned: list.length, rows: list };
}

export async function exportAll({ project } = {}){
  const data = await client.all({ fresh: true }), c = await view();
  const pid = project ? findProject(c, project).id : "";
  const dir = path.join(os.homedir(), "orbit-export", new Date().toISOString().replace(/[:.]/g, "-") + (pid ? "-" + pid : ""));
  fs.mkdirSync(dir, { recursive: true });
  const counts = {};
  for(const coll of Object.keys(data)){
    let list = data[coll].filter(r => !r.deleted);
    if(pid) list = list.filter(r => r.project_id === pid || r.id === pid);
    fs.writeFileSync(path.join(dir, coll + ".json"), JSON.stringify(list, null, 1));
    counts[coll] = list.length;
  }
  return { folder: dir, counts, note: "One JSON file per collection. Analyse with a script; cite record ids." };
}

/* ---------- writes ---------- */
export async function createProject({ name, account, domain, start, due, status = "In progress", welcome = "" }){
  return mutate(c => {
    let a = c.rows("accounts", x => String(x.name).toLowerCase() === String(account).toLowerCase() || (domain && x.domain === domain))[0];
    if(!a) a = c.insert("accounts", { name: account, domain: domain || "", industry: "", logo_color: c.hashColor(account), kind: "customer" });
    else if(domain && !a.domain) c.update("accounts", a.id, { domain });
    const p = c.insert("projects", { name, account_id: a.id, owner_id: "u-anand", status, start: start || c.todayISO(), due: due || "",
      start_actual: "", due_actual: "", team_ids: ["u-anand", "u-claude"], customer_ids: [], visibility: "EVERYONE",
      portal_tabs: { overview: true, plan: true, chat: true, files: true, updates: true }, portal_welcome: welcome,
      fields: { fee: 0, arr: 0, budget_hours: 0, billing: "" }, template_id: "", archived: false });
    c.logAct(p.id, "", "created the project " + name);
    return { project_id: p.id, account_id: a.id, name };
  });
}

export async function createPlan({ project, phases = [], deps = [] }){
  return mutate(c => {
    const p = findProject(c, project), keyToId = {}, errors = [];
    let order = c.projPhases(p.id).length;
    for(const ph of phases){
      let phase = c.projPhases(p.id).find(x => x.name.toLowerCase() === String(ph.name).toLowerCase());
      if(!phase) phase = c.insert("phases", { project_id: p.id, name: ph.name, order: order++, private: !!ph.private, status: "To do", start: "", due: "" });
      for(const t of ph.tasks || []){
        let start = t.start || "", due = t.due || "";
        if(start && !due && t.duration_days != null) due = c.addDays(start, Math.max(0, t.duration_days));
        if(!start && due) start = due;
        if(t.type === "MILESTONE"){ start = due || start; due = start; }
        const assignee = t.assignee ? who(c, t.assignee) : (t.doer === "claude" ? "u-claude" : "u-anand");
        const rec = c.insert("tasks", { project_id: p.id, phase_id: phase.id, parent_id: "", name: t.name, description: t.description || "",
          type: t.type || "TASK", status: t.status || "To do", priority: t.priority || "", at_risk: !!t.at_risk, start, due,
          start_actual: t.status === "Completed" || t.status === "In progress" ? (start || c.todayISO()) : "",
          due_actual: t.status === "Completed" ? (due || c.todayISO()) : "",
          assignee_ids: assignee ? [assignee] : [], follower_ids: [], effort_min: Math.round((t.effort_hours || 0) * 60),
          private: !!t.private, csat_enabled: false,
          doer: t.doer || (assignee === "u-claude" ? "claude" : "anand"), kind: t.kind || "", autonomy: t.autonomy || "",
          agent_brief: t.agent_brief || "", app_ref: t.app_ref || "", session_ref: "", source_ref: t.source_ref || "" });
        if(t.key) keyToId[t.key] = rec.id;
      }
    }
    for(const d of deps){
      const a = keyToId[d.task] || (c.byId("tasks", d.task) && d.task), b = keyToId[d.waits_on] || (c.byId("tasks", d.waits_on) && d.waits_on);
      if(!a || !b){ errors.push("Unknown task in dependency " + d.task + " → " + d.waits_on); continue; }
      const r = c.addDep(a, b); if(r.error) errors.push(d.task + " → " + d.waits_on + ": " + r.error);
    }
    c.recalcProject(p.id);
    c.logAct(p.id, "", "added a plan: " + phases.length + " phase(s), " + Object.keys(keyToId).length + " keyed task(s)");
    return { project_id: p.id, created: phases.reduce((n, ph) => n + (ph.tasks || []).length, 0), task_ids: keyToId, ...(errors.length ? { dependency_errors: errors } : {}) };
  });
}

export async function updateTask({ task, status, name, description, start, due, at_risk, assignee, doer, kind, autonomy, agent_brief, app_ref, session_ref, note }){
  return mutate(c => {
    const t = findTask(c, task), changed = [];
    if(status){ if(!c.TASK_STATUSES.includes(status)) throw new Error("status must be one of " + c.TASK_STATUSES.join(", ")); c.setTaskStatus(t, status); changed.push("status"); }
    if(start !== undefined || due !== undefined){ const moved = c.setTaskDates(t, start ?? t.start, due ?? t.due); changed.push("dates" + (moved.length ? " (moved " + moved.length + " dependent task(s))" : "")); }
    const patch = pick({ name, description, doer, kind, autonomy, agent_brief, app_ref, session_ref }, ["name", "description", "doer", "kind", "autonomy", "agent_brief", "app_ref", "session_ref"]);
    if(at_risk !== undefined) patch.at_risk = !!at_risk;
    if(assignee) patch.assignee_ids = [who(c, assignee)];
    if(Object.keys(patch).length){ c.update("tasks", t.id, patch); changed.push(...Object.keys(patch)); }
    if(note){
      c.insert("messages", { project_id: t.project_id, thread: "task:" + t.id, author_id: "u-claude", body: note, private: true, at: c.nowISO(), mentions: [] });
      changed.push("note");
    }
    if(changed.length && !status) c.logAct(t.project_id, t.id, "updated “" + t.name + "”: " + changed.join(", "));
    return { task_id: t.id, changed, task: taskLine(c, c.byId("tasks", t.id)) };
  });
}

export async function postUpdate({ project, body, private: priv = true }){
  return mutate(c => {
    const p = findProject(c, project);
    const u = c.insert("updates", { project_id: p.id, author_id: "u-claude", body, private: !!priv, at: c.nowISO() });
    c.logAct(p.id, "", "posted " + (priv ? "an internal" : "a customer") + " update");
    return { update_id: u.id, private: !!priv };
  });
}

export async function attach({ project, name, url, kind = "link", task, body = "" }){
  return mutate(c => {
    const p = findProject(c, project);
    const f = c.insert("files", { project_id: p.id, name, kind, url: url || "", body, private: true, author_id: "u-claude", at: c.nowISO() });
    if(task){ const t = findTask(c, task); c.insert("messages", { project_id: p.id, thread: "task:" + t.id, author_id: "u-claude", body: "Attached: " + name + (url ? " — " + url : ""), private: true, at: c.nowISO(), mentions: [] }); }
    c.logAct(p.id, task || "", "attached " + name);
    return { file_id: f.id };
  });
}

export async function logDecision({ project, text, decided_by = "", at, source = "", source_ref = "" }){
  return mutate(c => {
    const p = findProject(c, project);
    const d = c.insert("decisions", { project_id: p.id, text, decided_by, at: at || c.todayISO(), source, source_ref, status: "accepted" });
    c.logAct(p.id, "", "logged a decision: " + text.slice(0, 80));
    return { decision_id: d.id };
  });
}

export async function requestApproval({ task, note, due, approver = "anand", shared = false }){
  return mutate(c => {
    const t = findTask(c, task), uid = who(c, approver);
    const a = c.insert("approvals", { task_id: t.id, project_id: t.project_id, approver_ids: [uid], requested_by: "u-claude", due: due || "",
      status: "REQUESTED", type: shared ? "Shared" : "Internal", note: note || "", responded_by: "", responded_at: "" });
    c.notify(uid, "Claude needs your approval on “" + t.name + "”", "#/projects/" + t.project_id + "/plan?t=" + t.id);
    c.logAct(t.project_id, t.id, "requested approval on “" + t.name + "” from " + c.userName(uid));
    return { approval_id: a.id, waiting_on: c.userName(uid) };
  });
}

export async function approvalStatus({ approval }){
  const c = await view(); const a = (await client.all({ fresh: true })).approvals.find(x => x.id === approval);
  if(!a) throw new Error("No approval " + approval);
  return { approval_id: a.id, status: a.status, responded_by: a.responded_by ? c.userName(a.responded_by) : "", responded_at: a.responded_at, note: a.note };
}

export async function logRun({ task, agent, outcome, note = "", started_at, ended_at, session_ref = "" }){
  return mutate(c => {
    const t = task ? findTask(c, task) : null;
    const r = c.insert("agent_runs", { task_id: t ? t.id : "", project_id: t ? t.project_id : "", agent, session_ref,
      started_at: started_at || c.nowISO(), ended_at: ended_at || c.nowISO(), outcome, note });
    return { run_id: r.id };
  });
}

/* ---------- mail, transcripts and notes ---------- */
export async function sources({ project, unprocessed = false, words, since, limit = 50 }){
  const c = await view();
  const pid = project ? findProject(c, project).id : "";
  let list = c.rows("sources", s => (!pid || s.project_id === pid) && (!unprocessed || !s.processed_at) && (!since || (s.occurred_at || "") >= since));
  if(words){ const w = String(words).toLowerCase(); list = list.filter(s => [s.subject, s.summary, s.from, s.to, s.people].join(" ").toLowerCase().includes(w)); }
  list.sort(c.by(s => s.occurred_at || "")).reverse();
  return { total: list.length, sources: list.slice(0, limit).map(s => ({ ...pick(s, ["id", "kind", "occurred_at", "direction", "from", "to", "subject", "summary", "processed_at", "file_url", "size"]),
    project: (c.byId("projects", s.project_id) || {}).name || "(unassigned)" })) };
}
export async function getSource({ source, offset = 0, length = 40000 }){
  const j = await client.call("source_get", { id: source, offset, length });
  return { id: source, total_chars: j.total, offset: j.offset, text: j.text, more: j.offset + j.text.length < j.total };
}
export async function addSource({ kind = "transcript", project, file_path, text, subject, occurred_at, people = "" }){
  const c = await view(), p = project ? findProject(c, project) : null;
  const body = text != null ? String(text) : fs.readFileSync(file_path.replace(/^~/, os.homedir()), "utf8");
  const j = await client.call("source_add", { kind, project_id: p ? p.id : "", account_id: p ? p.account_id : "",
    subject: subject || (file_path ? path.basename(file_path) : kind), occurred_at: occurred_at || new Date().toISOString(), people, text: body }, { timeoutMs: 120000 });
  client.forget();
  return { source_id: j.id, file_url: j.file_url, chars: body.length };
}
export async function sourceDone({ source, summary = "", project }){
  return mutate(c => {
    const s = c.byId("sources", source); if(!s) throw new Error("No source " + source);
    const patch = { processed_at: c.nowISO() };
    if(summary) patch.summary = summary.slice(0, 2000);
    if(project) { const p = findProject(c, project); patch.project_id = p.id; patch.account_id = p.account_id; }
    c.update("sources", s.id, patch);
    return { source_id: s.id, processed_at: patch.processed_at };
  });
}
export async function mailSyncNow(){ const j = await client.call("mail_sync_now", {}, { timeoutMs: 360000 }); client.forget(); return j; }
