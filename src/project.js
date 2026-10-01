/* =====================================================================
   Project detail: header, tabs, overview, plan (board + gantt), list,
   chat, files, updates, settings — and the task drawer.
   ===================================================================== */

/* Per-viewer conveniences only (remembered toggles). Never data. */
let ui = Object.assign({ planMode:"board", who:"all", showDone:true, zoom:"week", q:"" }, read("lane.ui", {}));
function setUi(p){ Object.assign(ui, p); write("lane.ui", ui); scheduleRender(); }

function projectHeader(p, tab){
  const a = byId("accounts", p.account_id) || {}, hl = health(p.id);
  const tabs = [["overview","Overview","overview"],["plan","Plan","board"],["list","List","list"],
    ["chat","Chat","chat", rows("messages", m => m.project_id === p.id).length],
    ["files","Files","file", rows("files", f => f.project_id === p.id).length],
    ["updates","Updates","megaphone"],["settings","Settings","sliders"]];
  return [
    h("div", { class:"proj-h" },
      acctLogo(a, "lg"),
      h("div", { class:"grow" },
        h("a", { class:"acct", href:"#/accounts/" + a.id }, a.name),
        h("h1", null, p.name),
        h("div", { class:"split", style:"margin-top:6px;gap:10px;flex-wrap:wrap" },
          sel(PROJECT_STATUSES, p.status, v => { update("projects", p.id, { status:v }); logAct(p.id, "", "set the project status to " + v); commit(); }, "bare"),
          h("span", { class:"mono faint", style:"font-size:11.5px" }, fmtDY(p.start) + " → " + fmtDY(p.due)),
          h("span", { class:"dot-sep" }, "·"),
          h("span", { class:"chip " + (hl.inferred === "Running late" ? "red" : hl.inferred === "Ahead of time" || hl.inferred === "Completed" ? "jade" : "") }, hl.inferred),
          p.archived ? pill("Archived", "hold") : null)),
      h("div", { class:"acts" },
        h("span", { title:"Our team" }, avatars(p.team_ids)), h("span", { title:"Customer team" }, avatars(p.customer_ids)),
        h("button", { class:"btn", onclick:() => inviteModal(p) }, icon("users", "sm"), "Invite"),
        h("button", { class:"btn", onclick:() => go("portal/" + p.id + "/home") }, icon("eye", "sm"), "Customer view"),
        h("button", { class:"btn primary", onclick:() => quickTaskModal({ project_id:p.id }) }, icon("plus", "sm"), "New task"))),
    h("nav", { class:"tabs" }, tabs.map(t => h("a", { href:"#/projects/" + p.id + "/" + t[0], "aria-current":tab === t[0] ? "page" : null },
      icon(t[2], "sm"), t[1], t[3] ? h("span", { class:"cnt" }, t[3]) : null)))
  ];
}

function viewProject(r){
  const p = byId("projects", r.parts[1]);
  if(!p) return h("div", { class:"page" }, empty("That project doesn't exist any more."));
  const tab = r.parts[2] || "overview", a = byId("accounts", p.account_id) || {};
  crumbs = [["Projects", "#/projects"], [a.name, "#/accounts/" + a.id], [p.name]];
  const body = ({ overview:tabOverview, plan:tabPlan, list:tabList, chat:tabChat, files:tabFiles, updates:tabUpdates, settings:tabSettings }[tab] || tabOverview)(p, r);
  return h("div", { class:"page" + (tab === "plan" ? " wide" : "") }, projectHeader(p, tab), body);
}

/* ---------------- overview ---------------- */
function tabOverview(p){
  const hl = health(p.id), T = todayISO(), L = "#/projects/" + p.id + "/list?f=";
  const tiles = h("div", { class:"tiles" },
    tile(hl.pct + "%", hl.done.length + " / " + hl.tasks.length + " tasks done", "good"),
    tile(hl.overdue.length, "Overdue", hl.overdue.length ? "bad" : "", () => location.hash = L + "overdue"),
    tile(hl.atRisk.length, "At risk", hl.atRisk.length ? "warn" : "", () => location.hash = L + "atrisk"),
    tile(hl.blocked.length, "Blocked", hl.blocked.length ? "bad" : "", () => location.hash = L + "blocked"),
    tile(hl.pending.length, "Approvals pending", hl.pending.length ? "warn" : ""),
    tile(Math.max(0, diffDays(T, p.due || T)), "Days to due date"));

  const phs = projPhases(p.id), s0 = p.start, span = Math.max(1, diffDays(p.start, p.due));
  const pos = d => Math.max(0, Math.min(100, diffDays(s0, d) / span * 100));
  const phaseBars = h("div", { class:"phase-bars" }, phs.map(ph => {
    const ts = phaseTasks(ph.id), dn = ts.filter(t => t.status === "Completed").length, pc = ts.length ? Math.round(dn / ts.length * 100) : 0;
    const l = pos(ph.start), w = Math.max(1.5, pos(ph.due) - l);
    return h("div", { class:"pb" },
      h("div", { class:"nm", title:ph.name }, ph.private ? icon("lock", "xs") : null, " ", ph.name),
      h("div", { class:"track", title:fmtRange(ph.start, ph.due) },
        h("i", { style:{ left:l + "%", width:w + "%" } }, h("b", { style:{ width:pc + "%" } })),
        T >= s0 && T <= p.due ? h("span", { class:"now", style:{ left:pos(T) + "%" } }) : null),
      h("div", { class:"pct" }, pc + "%"));
  }));

  const attention = [].concat(
    hl.overdue.map(t => [t, h("span", { class:"chip red" }, dueLabel(t.due).text)]),
    hl.blocked.filter(t => !isOverdue(t)).map(t => [t, h("span", { class:"chip red" }, "Blocked")]),
    hl.atRisk.filter(t => !isOverdue(t) && t.status !== "Blocked").map(t => [t, h("span", { class:"chip gold" }, "At risk")]));
  const attnList = attention.length ? h("ul", { class:"tl" }, attention.map(x => taskLine(x[0], x[1]))) : empty("Nothing overdue, blocked or at risk.");

  const ms = h("ul", { class:"tl" }, hl.milestones.map(m => {
    let tag;
    if(m.status === "Completed"){ const d = m.due_actual ? diffDays(m.due, m.due_actual) : 0; tag = h("span", { class:"chip " + (d > 0 ? "gold" : "jade") }, d > 0 ? "Done " + d + "d late" : "Done"); }
    else if(m.due < T) tag = h("span", { class:"chip red" }, "Delayed by " + plural(diffDays(m.due, T), "day"));
    else tag = h("span", { class:"chip" }, "in " + plural(diffDays(T, m.due), "day"));
    return h("li", { class:"click", onclick:() => openTask(m.id) }, h("span", { style:"color:var(--violet)" }, icon("diamond", "sm")),
      h("div", { class:"grow" }, h("div", { class:"nm" }, m.name), h("div", { class:"ctx" }, "Planned " + fmtDY(m.due) + (m.due_actual ? " · actual " + fmtDY(m.due_actual) : ""))), tag);
  }));

  const ups = rows("updates", u => u.project_id === p.id).sort(by(u => u.at)).reverse().slice(0, 3);
  const team = projectPeople(p);
  const fee = (p.fields || {}).fee, arr = (p.fields || {}).arr;
  const portal = h("div", null,
    h("p", { class:"sub", style:"margin-bottom:10px" }, plural((p.customer_ids || []).length, "customer contact") + " invited. They see the plan, files and updates you share — nothing marked private."),
    h("button", { class:"btn sm", onclick:() => go("portal/" + p.id + "/home") }, icon("external", "sm"), "Open their portal"));

  return [tiles, h("div", { class:"grid g-main" },
    h("div", { class:"grid" },
      card("Phases", plural(phs.length, "phase"), phaseBars),
      card("Needs attention", attention.length || "", attnList, { icon:"alert" }),
      card("Milestones", plural(hl.milestones.length, "milestone"), hl.milestones.length ? ms : empty("No milestones yet.")),
      card("Latest updates", "", ups.length ? ups.map(updateItem) : empty("No updates posted."), { action:h("a", { class:"link", href:"#/projects/" + p.id + "/updates" }, "All updates") })),
    h("div", { class:"grid", style:"align-content:start" },
      card("Project info", null, h("div", { class:"kv" },
        h("span", { class:"k" }, "Owner"), h("span", null, userName(p.owner_id)),
        h("span", { class:"k" }, "Status"), h("span", null, statusPill(p.status)),
        h("span", { class:"k" }, "Start"), h("span", null, fmtDY(p.start)),
        h("span", { class:"k" }, "Due"), h("span", null, fmtDY(p.due)),
        h("span", { class:"k" }, "Project fee"), h("span", null, fee ? "$" + Number(fee).toLocaleString() : "—"),
        h("span", { class:"k" }, "ARR"), h("span", null, arr ? "$" + Number(arr).toLocaleString() : "—"),
        h("span", { class:"k" }, "Budget"), h("span", null, ((p.fields || {}).budget_hours || "—") + " h · " + ((p.fields || {}).billing || "")),
        h("span", { class:"k" }, "Logged"), h("span", null, fmtMins(rows("time_entries", e => e.project_id === p.id).reduce((s, e) => s + (e.minutes || 0), 0)) + " h")),
        { internal:true, only:"Only your team" }),
      card("Customer portal", null, portal),
      card("Team", plural(team.length, "person", "people"), h("div", { class:"grid", style:"gap:10px" },
        h("div", { class:"lab" }, "Our team"), team.filter(u => !isCustomer(u)).map(u => whoRow(u, u.role + (u.id === p.owner_id ? " · owner" : ""))),
        h("div", { class:"lab", style:"margin-top:6px" }, "Customer team"), team.filter(isCustomer).map(u => whoRow(u)),
        h("button", { class:"btn sm", style:"justify-self:start", onclick:() => inviteModal(p) }, icon("plus", "sm"), "Invite customer contact"))))) ];
}
function taskLine(t, right){
  const p = byId("projects", t.project_id), dl = dueLabel(t.due, t.status === "Completed");
  return h("li", { class:"click", onclick:() => openTask(t.id) }, statusCircle(t),
    h("div", { class:"grow" }, h("div", { class:"nm" }, t.name), h("div", { class:"ctx" }, (p ? p.name + " · " : "") + ((byId("phases", t.phase_id) || {}).name || ""))),
    avatars(t.assignee_ids), right || h("span", { class:"when" + (dl.late ? " late" : "") }, dl.text));
}

/* ---------------- plan: filters ---------------- */
function planFilter(p){
  const mine = me().id;
  return t => {
    if(!ui.showDone && t.status === "Completed") return false;
    if(ui.q && t.name.toLowerCase().indexOf(ui.q.toLowerCase()) === -1) return false;
    const as = t.assignee_ids || [];
    if(ui.who === "mine" && as.indexOf(mine) === -1) return false;
    if(ui.who === "team" && !as.some(id => !isCustomer(byId("users", id)))) return false;
    if(ui.who === "customer" && !as.some(id => isCustomer(byId("users", id)))) return false;
    return true;
  };
}
function planBar(p){
  return h("div", { class:"planbar" },
    segm([["board","Board","board"],["gantt","Gantt","gantt"]], ui.planMode, v => setUi({ planMode:v })),
    segm([["all","All"],["team","Our team"],["customer","Customer"],["mine","Mine"]], ui.who, v => setUi({ who:v })),
    h("input", { class:"inp", style:"width:200px", placeholder:"Filter tasks", value:ui.q, oninput:e => { ui.q = e.target.value; write("lane.ui", ui); scheduleRender(); } }),
    h("label", { class:"chk-l" }, h("input", { type:"checkbox", checked:ui.showDone, onchange:e => setUi({ showDone:e.target.checked }) }), "Show completed"),
    h("span", { class:"grow" }),
    ui.planMode === "gantt" ? segm([["day","Days"],["week","Weeks"],["month","Months"]], ui.zoom, v => setUi({ zoom:v })) : null,
    h("button", { class:"btn", onclick:() => addPhaseModal(p) }, icon("plus", "sm"), "Phase"));
}
function tabPlan(p){ return [planBar(p), ui.planMode === "gantt" ? gantt(p) : board(p)]; }

/* ---------------- plan: board ---------------- */
let dragTask = null;
function board(p){
  const f = planFilter(p), T = todayISO();
  const cols = projPhases(p.id).map(ph => {
    const all = phaseTasks(ph.id), ts = all.filter(f), dn = all.filter(t => t.status === "Completed").length;
    const pc = all.length ? Math.round(dn / all.length * 100) : 0, complete = all.length && dn === all.length;
    const col = h("div", { class:"col" + (ph.private ? " priv" : ""),
      ondragover:e => { if(!dragTask) return; e.preventDefault(); col.classList.add("drop"); },
      ondragleave:() => col.classList.remove("drop"),
      ondrop:e => { e.preventDefault(); col.classList.remove("drop"); if(!dragTask) return;
        const t = byId("tasks", dragTask), from = t.phase_id; dragTask = null;
        if(from === ph.id) return;
        update("tasks", t.id, { phase_id:ph.id }); subtasks(t.id).forEach(s => update("tasks", s.id, { phase_id:ph.id }));
        recalcPhase(from); recalcPhase(ph.id); logAct(p.id, t.id, "moved “" + t.name + "” to " + ph.name); commit(); } },
      h("div", { class:"col-h" },
        h("div", { class:"t" }, complete ? h("span", { class:"col-done", title:"Phase complete" }, icon("check", "xs")) : null,
          h("b", null, ph.name), ph.private ? h("span", { class:"only", title:"Hidden from the customer" }, icon("lock", "xs"), "Private") : null,
          h("button", { class:"iconbtn", style:"width:26px;height:26px", title:"Phase options", onclick:e => phaseMenu(e.currentTarget, ph) }, icon("dots", "sm"))),
        h("div", { class:"dates" }, h("span", null, fmtRange(ph.start, ph.due)), h("span", null, dn + "/" + all.length),
          ph.due && ph.due < T && !complete ? h("span", { class:"red" }, "overrun") : null),
        bar(pc)),
      h("div", { class:"col-b", "data-sk":"col-" + ph.id }, ts.length ? ts.map(t => taskCard(t)) : h("div", { class:"empty", style:"padding:10px" }, all.length ? "Filtered out" : "No tasks yet")),
      h("div", { class:"col-add" }, h("input", { placeholder:"+ Add a task", onkeydown:e => {
        if(e.key !== "Enter" || !e.target.value.trim()) return;
        const s = ph.start && ph.start > T ? ph.start : T;
        const t = insert("tasks", { project_id:p.id, phase_id:ph.id, parent_id:"", name:e.target.value.trim(), description:"", type:"TASK", status:"To do", priority:"",
          at_risk:false, start:s, due:s, start_actual:"", due_actual:"", assignee_ids:[me().id], follower_ids:[], effort_min:0, private:!!ph.private, csat_enabled:false });
        logAct(p.id, t.id, "added “" + t.name + "”"); recalcPhase(ph.id);
        e.target.value = ""; saveDb(); render(); const again = document.querySelector('[data-sk="col-' + ph.id + '"]'); if(again) again.scrollTop = 1e6;
        const inp = again && again.parentNode.querySelector(".col-add input"); if(inp) inp.focus();
      } })));
    return col;
  });
  return h("div", { class:"board", "data-sk":"board" }, cols,
    h("div", { class:"col", style:"background:transparent;border-style:dashed;flex-basis:240px" },
      h("button", { class:"btn ghost", style:"margin:12px", onclick:() => addPhaseModal(p) }, icon("plus", "sm"), "Add phase")));
}
function taskCard(t){
  const done = t.status === "Completed", dl = dueLabel(t.due, done), subs = subtasks(t.id);
  const waits = rows("deps", d => d.task_id === t.id).map(d => byId("tasks", d.blocked_by_id)).filter(b => b && b.status !== "Completed");
  const pend = rows("approvals", a => a.task_id === t.id && a.status === "REQUESTED").length;
  const msgs = rows("messages", m => m.thread === "task:" + t.id).length;
  return h("div", { class:"tcard" + (done ? " is-done" : "") + (t.private ? " priv" : ""), draggable:"true", "data-t":t.id,
      ondragstart:e => { dragTask = t.id; e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); },
      ondragend:e => { e.currentTarget.classList.remove("dragging"); dragTask = null; },
      onclick:() => openTask(t.id) },
    statusCircle(t),
    h("div", { class:"tc-b" }, h("div", { class:"tc-n" }, t.name),
      h("div", { class:"tc-m" },
        h("span", { class:dl.late ? "late" : "" }, t.type === "MILESTONE" ? fmtD(t.due) : fmtRange(t.start, t.due)),
        t.at_risk && !done ? h("span", { class:"chip gold" }, "At risk") : null,
        waits.length ? h("span", { class:"chip", title:"Waiting on: " + waits.map(b => b.name).join(", ") }, icon("link", "xs"), waits.length) : null,
        pend ? h("span", { class:"chip gold", title:"Approval pending" }, icon("flag", "xs"), pend) : null,
        subs.length ? h("span", { class:"chip" }, subs.filter(s => s.status === "Completed").length + "/" + subs.length) : null,
        msgs ? h("span", { class:"chip" }, icon("chat", "xs"), msgs) : null,
        t.private ? h("span", { title:"Private — hidden from the customer", style:"color:var(--gold)" }, icon("lock", "xs")) : null,
        h("span", { class:"grow" }), avatars(t.assignee_ids))));
}
function phaseMenu(anchor, ph){
  openPop(anchor, [
    h("button", { class:"pop-i", onclick:() => { closePop(); textModal("Rename phase", "Phase name", ph.name, v => { update("phases", ph.id, { name:v }); commit(); }); } }, icon("pencil", "sm"), "Rename"),
    h("button", { class:"pop-i", onclick:() => { closePop(); update("phases", ph.id, { private:!ph.private }); logAct(ph.project_id, "", (ph.private ? "made “" : "shared “") + ph.name + (ph.private ? "” private" : "” with the customer")); commit(); } },
      icon(ph.private ? "eye" : "lock", "sm"), ph.private ? "Share with customer" : "Make private"),
    h("button", { class:"pop-i", onclick:() => { closePop(); quickTaskModal({ project_id:ph.project_id, phase_id:ph.id }); } }, icon("plus", "sm"), "Add task…"),
    h("button", { class:"pop-i", style:"color:var(--red)", onclick:() => { closePop();
      const n = phaseTasks(ph.id).length;
      confirmBox("Delete “" + ph.name + "”?", n ? "This also deletes its " + plural(n, "task") + ". This can't be undone." : "The phase is empty.", "Delete phase", () => {
        rows("tasks", t => t.phase_id === ph.id).forEach(t => remove("tasks", t.id)); remove("phases", ph.id); commit(); }, true); } }, icon("trash", "sm"), "Delete phase")]);
}
function addPhaseModal(p){
  textModal("Add a phase", "Phase name", "", v => {
    const n = projPhases(p.id).length, last = projPhases(p.id).slice(-1)[0];
    const s = last && last.due ? addDays(last.due, 1) : p.start || todayISO();
    insert("phases", { project_id:p.id, name:v, order:n, private:false, status:"To do", start:s, due:s });
    logAct(p.id, "", "added phase “" + v + "”"); commit();
  });
}
function textModal(title, label, value, onOk){
  openModal(() => {
    const i = h("input", { class:"inp", value, onkeydown:e => { if(e.key === "Enter") ok(); } });
    const ok = () => { const v = i.value.trim(); if(!v) return; closeModal(); onOk(v); };
    return [modalHead(title), h("div", { class:"modal-b" }, h("div", { class:"fld" }, h("label", null, label), i)),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:ok }, "Save"))];
  }, "narrow");
}

/* ---------------- plan: gantt ---------------- */
function gantt(p){
  const f = planFilter(p), phs = projPhases(p.id), T = todayISO();
  const PX = { day:30, week:13, month:4.5 }[ui.zoom] || 13, RH = 34, HD = 46;
  let s = p.start || T, e = p.due || T;
  phs.forEach(ph => { s = minD(s, ph.start); e = maxD(e, ph.due); });
  s = addDays(weekStart(s), -3); e = addDays(e, 10);
  const days = diffDays(s, e) + 1, W = Math.ceil(days * PX), x = d => diffDays(s, d) * PX;
  const lines = [];   // {kind, ph|t, y}
  phs.forEach(ph => {
    const ts = phaseTasks(ph.id).filter(f);
    lines.push({ kind:"ph", ph }); ts.forEach(t => lines.push({ kind:"t", t }));
  });
  const H = lines.length * RH, rowY = {};
  lines.forEach((l, i) => { if(l.t) rowY[l.t.id] = HD + i * RH + RH / 2; });

  const left = h("div", { class:"g-left" }, h("div", { class:"g-hd" }, h("span", { class:"lab", style:"margin:0" }, "Phase / task")),
    lines.map(l => l.kind === "ph"
      ? h("div", { class:"g-row ph" }, l.ph.private ? icon("lock", "xs") : null, h("span", { class:"nm" }, l.ph.name), h("span", { class:"mono faint", style:"font-size:10.5px;font-weight:400" }, fmtRange(l.ph.start, l.ph.due)))
      : h("div", { class:"g-row sub", onclick:() => openTask(l.t.id) }, statusCircle(l.t), h("span", { class:"nm" }, l.t.name), avatars(l.t.assignee_ids))));

  const NS = "http://www.w3.org/2000/svg";
  const sv = (tag, a, txt) => { const el = document.createElementNS(NS, tag); for(const k in a) el.setAttribute(k, a[k]); if(txt != null) el.textContent = txt; return el; };
  const svg = sv("svg", { width:W, height:HD + H, viewBox:"0 0 " + W + " " + (HD + H) });
  const defs = sv("defs", {}); const mk = sv("marker", { id:"arr", viewBox:"0 0 8 8", refX:"7", refY:"4", markerWidth:"7", markerHeight:"7", orient:"auto-start-reverse" });
  mk.appendChild(sv("path", { d:"M0 0 8 4 0 8z", fill:"#8A8394" })); defs.appendChild(mk); svg.appendChild(defs);
  // shading + grid
  for(let i = 0; i < days; i++){
    const d = addDays(s, i), dt = parseISO(d), wd = dt.getDay();
    if(ui.zoom !== "month" && (wd === 0 || wd === 6)) svg.appendChild(sv("rect", { x:i * PX, y:HD, width:PX, height:H, fill:"#F7F5F9" }));
    if(dt.getDate() === 1 || i === 0){
      svg.appendChild(sv("line", { x1:i * PX, x2:i * PX, y1:0, y2:HD + H, stroke:"#E6E2EB" }));
      svg.appendChild(sv("text", { x:i * PX + 6, y:17, "font-size":"11", "font-weight":"600", fill:"#221C29", "font-family":"Instrument Sans,system-ui" }, MON[dt.getMonth()] + " " + dt.getFullYear()));
    }
    const tick = ui.zoom === "day" ? true : ui.zoom === "week" ? wd === 1 : dt.getDate() === 1 || dt.getDate() === 15;
    if(tick && !(ui.zoom === "month" && dt.getDate() === 1)) svg.appendChild(sv("text", { x:i * PX + (ui.zoom === "day" ? PX / 2 : 3), y:37, "font-size":"10", fill:"#8A8394",
      "text-anchor":ui.zoom === "day" ? "middle" : "start", "font-family":"IBM Plex Mono,monospace" }, String(dt.getDate())));
  }
  svg.appendChild(sv("line", { x1:0, x2:W, y1:HD - .5, y2:HD - .5, stroke:"#E6E2EB" }));
  lines.forEach((l, i) => svg.appendChild(sv("line", { x1:0, x2:W, y1:HD + (i + 1) * RH - .5, y2:HD + (i + 1) * RH - .5, stroke:"#EDEAF1" })));
  // dependency arrows (drawn under bars)
  const tsShown = {}; lines.forEach(l => { if(l.t) tsShown[l.t.id] = l.t; });
  rows("deps", d => d.project_id === p.id && tsShown[d.task_id] && tsShown[d.blocked_by_id]).forEach(d => {
    const a = tsShown[d.blocked_by_id], b = tsShown[d.task_id];
    const x1 = x(a.due) + PX, y1 = rowY[a.id], x2 = x(b.start || b.due), y2 = rowY[b.id], mid = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
    svg.appendChild(sv("path", { d:"M" + x1 + " " + y1 + " H" + mid + " V" + y2 + " H" + (x2 - 1), fill:"none", stroke:"#8A8394", "stroke-width":"1.2", "marker-end":"url(#arr)", opacity:".75" }));
  });
  const FILL = { "To do":"#B9B0C6", "In progress":"#3D63B0", "Completed":"#2E8F6C", "Blocked":"#B4483F" };
  lines.forEach((l, i) => {
    const y = HD + i * RH;
    if(l.kind === "ph"){
      if(!l.ph.start) return;
      const ts = phaseTasks(l.ph.id), pc = ts.length ? ts.filter(t => t.status === "Completed").length / ts.length : 0;
      const bx = x(l.ph.start), bw = Math.max(PX, (diffDays(l.ph.start, l.ph.due) + 1) * PX);
      svg.appendChild(sv("rect", { x:bx, y:y + 12, width:bw, height:10, rx:3, fill:l.ph.private ? "#EBDCBC" : "#D9D2E2" }));
      svg.appendChild(sv("rect", { x:bx, y:y + 12, width:bw * pc, height:10, rx:3, fill:"#221C29", opacity:".75" }));
      return;
    }
    const t = l.t; if(!t.due && !t.start) return;
    const g = sv("g", { class:"g-bar", "data-t":t.id });
    const tt = sv("title", {}, t.name + " · " + fmtRange(t.start, t.due) + " · " + t.status); g.appendChild(tt);
    if(t.type === "MILESTONE"){
      const cx = x(t.due) + PX / 2, cy = y + RH / 2, r = 8;
      g.appendChild(sv("path", { d:"M" + cx + " " + (cy - r) + " L" + (cx + r) + " " + cy + " L" + cx + " " + (cy + r) + " L" + (cx - r) + " " + cy + "z",
        fill:t.status === "Completed" ? "#2E8F6C" : "#7457A6", stroke:t.due < T && t.status !== "Completed" ? "#B4483F" : "none", "stroke-width":"2" }));
      g.appendChild(sv("text", { x:cx + 13, y:cy + 4, "font-size":"11", fill:"#6B6276", "font-family":"Instrument Sans,system-ui" }, t.name));
    } else {
      const bx = x(t.start || t.due), bw = Math.max(PX * .8, (diffDays(t.start || t.due, t.due || t.start) + 1) * PX);
      g.appendChild(sv("rect", { x:bx, y:y + 8, width:bw, height:RH - 16, rx:5, fill:FILL[t.status] || "#B9B0C6",
        stroke:isOverdue(t) ? "#B4483F" : t.at_risk ? "#A8700F" : "none", "stroke-width":"2", opacity:t.private ? ".7" : "1" }));
      if(t.status === "In progress") g.appendChild(sv("rect", { x:bx, y:y + 8, width:bw, height:RH - 16, rx:5, fill:"none" }));
      g.appendChild(sv("text", { x:bx + bw + 6, y:y + RH / 2 + 4, "font-size":"11", fill:"#6B6276", "font-family":"Instrument Sans,system-ui" }, t.name));
    }
    ganttDrag(g, t, PX);
    svg.appendChild(g);
  });
  if(T >= s && T <= e){
    svg.appendChild(sv("line", { x1:x(T) + PX / 2, x2:x(T) + PX / 2, y1:HD - 6, y2:HD + H, stroke:"#A8700F", "stroke-width":"2" }));
    svg.appendChild(sv("text", { x:x(T) + PX / 2 + 4, y:HD - 8, "font-size":"9.5", fill:"#A8700F", "font-family":"IBM Plex Mono,monospace" }, "TODAY"));
  }
  const right = h("div", { class:"g-right", "data-sk":"gantt" }, svg);
  setTimeout(() => { if(right.scrollLeft === 0 && !right.dataset.done){ right.dataset.done = 1; right.scrollLeft = Math.max(0, x(T) - 240); } }, 0);
  return [h("div", { class:"gantt" }, left, right),
    h("p", { class:"sub", style:"margin-top:10px;font-size:12px" }, "Drag a bar to move a task. Tasks that wait on it move with it; nothing else does.")];
}
function ganttDrag(g, t, PX){
  let x0 = null, moved = false;
  g.addEventListener("pointerdown", e => { x0 = e.clientX; moved = false; g.setPointerCapture(e.pointerId); });
  g.addEventListener("pointermove", e => { if(x0 == null) return; const dx = e.clientX - x0; if(Math.abs(dx) > 3) moved = true;
    g.setAttribute("transform", "translate(" + (Math.round(dx / PX) * PX) + ",0)"); });
  g.addEventListener("pointerup", e => {
    if(x0 == null) return; const days = Math.round((e.clientX - x0) / PX); x0 = null; g.removeAttribute("transform");
    if(!moved){ openTask(t.id); return; }
    if(!days) return;
    const m = setTaskDates(t, t.start ? addDays(t.start, days) : "", t.due ? addDays(t.due, days) : "");
    logAct(t.project_id, t.id, "moved “" + t.name + "” by " + plural(days, "day"));
    commit(); toast("Moved “" + t.name + "” " + (days > 0 ? "later" : "earlier") + " by " + plural(Math.abs(days), "day") + (m.length ? " · " + plural(m.length, "dependent task") + " followed" : ""));
  });
}

/* ---------------- list ---------------- */
function tabList(p, r){
  const f = r.q.f || "", T = todayISO(), mine = me().id, people = projectPeople(p);
  const match = t => f === "overdue" ? isOverdue(t) : f === "atrisk" ? t.at_risk && t.status !== "Completed" : f === "blocked" ? t.status === "Blocked"
    : f === "open" ? t.status !== "Completed" : f === "done" ? t.status === "Completed" : f === "mine" ? (t.assignee_ids || []).indexOf(mine) > -1 : true;
  const body = [];
  projPhases(p.id).forEach(ph => {
    const ts = phaseTasks(ph.id).filter(match).filter(t => !ui.q || t.name.toLowerCase().indexOf(ui.q.toLowerCase()) > -1);
    if(!ts.length) return;
    body.push(h("tr", { class:"grp" }, h("td", { colspan:8 }, ph.private ? icon("lock", "xs") : null, " ", ph.name, h("span", { class:"faint mono", style:"font-weight:400;margin-left:10px;font-size:11px" }, fmtRange(ph.start, ph.due)))));
    ts.forEach(t => body.push(h("tr", null,
      h("td", { style:"width:30px" }, statusCircle(t)),
      h("td", null, h("a", { href:"javascript:void 0", onclick:() => openTask(t.id), style:"color:var(--text);font-weight:500" }, t.name),
        t.private ? h("span", { style:"color:var(--gold);margin-left:6px" }, icon("lock", "xs")) : null,
        t.at_risk && t.status !== "Completed" ? h("span", { class:"chip gold", style:"margin-left:6px" }, "At risk") : null),
      h("td", null, sel(TASK_STATUSES, t.status, v => { setTaskStatus(t, v); commit(); }, "bare")),
      h("td", null, sel([["", "Unassigned"]].concat(people.map(u => [u.id, u.name + (isCustomer(u) ? " (customer)" : "")])), (t.assignee_ids || [])[0] || "",
        v => { assignTask(t, v ? [v] : []); commit(); }, "bare")),
      h("td", null, t.type === "MILESTONE" ? h("span", { class:"faint" }, "—") : dateInp(t.start, v => { const m = setTaskDates(t, v, t.due); commit(); if(m.length) toast(plural(m.length, "dependent task") + " moved"); }, { class:"inp bare" })),
      h("td", { class:isOverdue(t) ? "red" : "" }, dateInp(t.due, v => { const m = setTaskDates(t, t.type === "MILESTONE" ? v : t.start, v); commit(); if(m.length) toast(plural(m.length, "dependent task") + " moved"); }, { class:"inp bare" })),
      h("td", { class:"num" }, t.effort_min ? Math.round(t.effort_min / 60) + "h" : "—"),
      h("td", null, h("button", { class:"chk-l", title:t.private ? "Private — click to share with the customer" : "Shared — click to make private",
        onclick:() => { update("tasks", t.id, { private:!t.private }); commit(); } }, icon(t.private ? "lock" : "eye", "sm"), t.private ? "Private" : "Shared")))));
  });
  return [
    h("div", { class:"filters" },
      segm([["","All"],["open","Open"],["mine","Mine"],["overdue","Overdue"],["atrisk","At risk"],["blocked","Blocked"],["done","Completed"]], f, v => go("projects/" + p.id + "/list", v ? { f:v } : null)),
      h("input", { class:"inp", style:"width:200px", placeholder:"Filter tasks", value:ui.q, oninput:e => { ui.q = e.target.value; write("lane.ui", ui); scheduleRender(); } }),
      h("span", { style:"flex:1" }),
      h("button", { class:"btn primary", onclick:() => quickTaskModal({ project_id:p.id }) }, icon("plus", "sm"), "New task")),
    h("div", { class:"card" }, h("div", { class:"tbl-wrap" }, h("table", { class:"tbl" },
      h("thead", null, h("tr", null, h("th"), h("th", null, "Task"), h("th", null, "Status"), h("th", null, "Assignee"), h("th", null, "Start"), h("th", null, "Due"), h("th", { class:"num" }, "Effort"), h("th", null, "Visibility"))),
      h("tbody", null, body.length ? body : h("tr", null, h("td", { colspan:8 }, empty("No tasks match this filter.")))))))];
}
function assignTask(t, ids){
  const added = ids.filter(id => (t.assignee_ids || []).indexOf(id) === -1);
  update("tasks", t.id, { assignee_ids:ids });
  added.forEach(id => { notify(id, firstName(me().id) + " assigned you “" + t.name + "”", "#/projects/" + t.project_id + "/plan?t=" + t.id);
    logAct(t.project_id, t.id, "assigned “" + t.name + "” to " + userName(id)); });
}

/* ---------------- chat ---------------- */
const drafts = {}, composerPriv = {};
function tabChat(p, r){
  const th = r.q.th || "general";
  const taskThreads = uniq(rows("messages", m => m.project_id === p.id && m.thread.indexOf("task:") === 0).map(m => m.thread));
  const last = t => { const ms = rows("messages", m => m.project_id === p.id && m.thread === t); return ms.length ? ms.sort(by(m => m.at)).slice(-1)[0] : null; };
  const thr = (key, label, ic, extra) => h("button", { class:"thr", "aria-current":String(th === key), onclick:() => go("projects/" + p.id + "/chat", { th:key }) },
    icon(ic, "sm"), h("span", { class:"grow" }, label), extra);
  return h("div", { class:"chat" },
    h("div", { class:"threads" },
      h("div", { class:"thr-sec" }, "Shared with customer"), thr("general", "General chat", "chat"),
      h("div", { class:"thr-sec" }, "Only your team"), thr("private", "Private chat", "lock"),
      taskThreads.length ? h("div", { class:"thr-sec" }, "Task conversations") : null,
      taskThreads.map(k => { const t = byId("tasks", k.slice(5)); return t ? thr(k, t.name, "tasks", h("span", { class:"faint mono", style:"font-size:10px" }, fmtAgo((last(k) || {}).at))) : null; }),
      h("p", { class:"sub", style:"font-size:12px;padding:12px 11px" }, "Type ", h("span", { class:"kbd" }, "@"), " to mention a person, ", h("span", { class:"kbd" }, "@@"), " to link a task — that also starts a conversation on the task.")),
    convo(p, th, { full:true }));
}
function convo(p, thread, opts){
  opts = opts || {};
  const viewer = opts.viewer || me(), cust = isCustomer(viewer);
  const isPrivThread = thread === "private";
  const msgs = rows("messages", m => m.project_id === p.id && m.thread === thread && visibleTo(viewer, "messages", m)).sort(by(m => m.at));
  const tname = thread.indexOf("task:") === 0 ? (byId("tasks", thread.slice(5)) || {}).name : null;
  const priv = isPrivThread || (!cust && !!composerPriv[thread]);
  const ta = h("textarea", { placeholder:priv ? "Private — only your team will see this" : cust ? "Write a message to the team" : "Message everyone, including the customer",
    value:drafts[thread] || "", oninput:e => { drafts[thread] = e.target.value; mentionPop(e.target, p, viewer); },
    onkeydown:e => { if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){ e.preventDefault(); send(); } } });
  const send = () => {
    const body = ta.value.trim(); if(!body) return;
    postMessage(p, thread, body, priv, viewer);
    drafts[thread] = ""; ta.value = ""; commit();
  };
  const box = h("div", { class:"convo" + (isPrivThread ? " private" : ""), style:opts.full ? null : "min-height:0;box-shadow:none" },
    opts.full ? h("div", { class:"convo-h" }, icon(isPrivThread ? "lock" : thread === "general" ? "chat" : "tasks", "sm"),
      h("b", null, isPrivThread ? "Private chat" : thread === "general" ? "General chat" : tname),
      isPrivThread ? h("span", { class:"only" }, icon("lock", "xs"), "Only your team") : thread === "general" ? h("span", { class:"pill cust" }, "Customer can see") : null,
      tname ? h("button", { class:"btn sm", onclick:() => openTask(thread.slice(5)) }, "Open task") : null) : null,
    h("div", { class:"msgs", "data-sk":"msgs-" + thread, style:opts.full ? null : "max-height:340px" },
      msgs.length ? msgs.map(m => msgView(m, p)) : empty("No messages yet.")),
    h("div", { class:"composer" + (priv ? " priv" : "") },
      ta,
      h("div", { class:"cbar" },
        !cust && !isPrivThread ? h("label", { class:"chk-l", title:"A private message is hidden from the customer" },
          h("input", { type:"checkbox", checked:priv, onchange:e => { composerPriv[thread] = e.target.checked; drafts[thread] = ta.value; render(); } }), icon("lock", "xs"), "Private") : null,
        h("span", { class:"grow" }, "⌘/Ctrl + Enter to send"),
        h("button", { class:"btn sm primary", onclick:send }, icon("send", "sm"), "Send"))));
  if(opts.full) setTimeout(() => { const ms = box.querySelector(".msgs"); if(ms && !ms.dataset.stuck){ ms.dataset.stuck = 1; ms.scrollTop = ms.scrollHeight; } }, 0);
  return box;
}
function postMessage(p, thread, body, priv, viewer){
  const people = projectPeople(p), tasks = rows("tasks", t => t.project_id === p.id);
  const mentions = people.filter(u => body.indexOf("@" + u.name) > -1).map(u => u.id);
  const tmentions = tasks.filter(t => body.indexOf("@@" + t.name) > -1);
  const m = insert("messages", { project_id:p.id, thread, author_id:viewer.id, body, private:!!priv, at:nowISO(), mentions });
  const where = thread === "general" ? "General chat" : thread === "private" ? "Private chat" : "“" + (byId("tasks", thread.slice(5)) || {}).name + "”";
  const link = thread.indexOf("task:") === 0 ? "#/projects/" + p.id + "/plan?t=" + thread.slice(5) : "#/projects/" + p.id + "/chat?th=" + thread;
  mentions.forEach(u => { if(!(priv && isCustomer(byId("users", u)))) notify(u, viewer.name + " mentioned you in " + where, link); });
  /* Mentioning a task starts (or continues) a conversation on that task. */
  tmentions.forEach(t => { if("task:" + t.id !== thread) insert("messages", { project_id:p.id, thread:"task:" + t.id, author_id:viewer.id,
    body:"Mentioned in " + where + ": " + body, private:!!priv || thread === "private", at:nowISO(), mentions:[] }); });
  if(isCustomer(viewer)) notify(p.owner_id, viewer.name + " posted in " + where, link);
  return m;
}
function msgView(m, p){
  let html = esc(m.body);
  rows("tasks", t => t.project_id === p.id).sort(by(t => -t.name.length)).forEach(t => {
    const k = esc("@@" + t.name); if(html.indexOf(k) > -1) html = html.split(k).join('<span class="mention task" data-t="' + t.id + '">@@' + esc(t.name) + "</span>");
  });
  projectPeople(p).forEach(u => { const k = esc("@" + u.name); if(html.indexOf(k) > -1) html = html.split(k).join('<span class="mention">@' + esc(u.name) + "</span>"); });
  const u = byId("users", m.author_id);
  const txt = h("div", { class:"txt", html });
  txt.querySelectorAll(".mention.task").forEach(s => s.addEventListener("click", () => openTask(s.dataset.t)));
  return h("div", { class:"msg" + (m.private ? " priv" : "") }, avatar(u),
    h("div", { class:"bub" }, h("div", { class:"meta" }, h("b", null, u ? u.name : "Someone"), u && isCustomer(u) ? pill("Customer", "cust") : null,
      h("span", null, fmtAgo(m.at)), m.private ? h("span", { class:"only" }, icon("lock", "xs"), "Private") : null), txt));
}
/* @ people, @@ tasks — a small picker that replaces the token being typed. */
function mentionPop(ta, p, viewer){
  const old = ta.parentNode.querySelector(".mpop"); if(old) old.remove();
  const before = ta.value.slice(0, ta.selectionStart), m = before.match(/(^|\s)(@@?)([^@\n]{0,40})$/);
  if(!m) return;
  const isTask = m[2] === "@@", q = m[3].toLowerCase();
  const items = isTask
    ? rows("tasks", t => t.project_id === p.id && visibleTo(viewer, "tasks", t) && t.name.toLowerCase().indexOf(q) > -1).slice(0, 8).map(t => [t.name, icon("tasks", "sm"), t.status])
    : projectPeople(p).filter(u => u.name.toLowerCase().indexOf(q) > -1).slice(0, 8).map(u => [u.name, avatar(u, "sm"), u.role]);
  if(!items.length) return;
  const pick = name => {
    const start = ta.selectionStart - m[3].length - m[2].length;
    ta.value = ta.value.slice(0, start) + m[2] + name + " " + ta.value.slice(ta.selectionStart);
    ta.dispatchEvent(new Event("input")); ta.focus();
    const pop = ta.parentNode.querySelector(".mpop"); if(pop) pop.remove();
  };
  ta.parentNode.appendChild(h("div", { class:"mpop" }, items.map(it => h("button", { onmousedown:e => { e.preventDefault(); pick(it[0]); } }, it[1],
    h("span", { style:"flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, it[0]), h("small", { class:"faint" }, it[2])))));
}

/* ---------------- files ---------------- */
function tabFiles(p, r, viewer){
  viewer = viewer || me();
  const cust = isCustomer(viewer);
  const fs = rows("files", f => f.project_id === p.id && visibleTo(viewer, "files", f)).sort(by(f => f.at)).reverse();
  return [
    h("div", { class:"filters" }, h("span", { class:"sub", style:"flex:1" }, cust ? "Files your team has shared with you. You can add a link too." : "Documents and links. Private ones never reach the customer."),
      !cust ? h("button", { class:"btn", onclick:() => fileModal(p, "doc") }, icon("file", "sm"), "New document") : null,
      h("button", { class:"btn primary", onclick:() => fileModal(p, "link", viewer) }, icon("link", "sm"), "Add a link")),
    h("div", { class:"card" }, fs.length ? h("table", { class:"tbl" },
      h("thead", null, h("tr", null, h("th", null, "Name"), h("th", null, "Added by"), h("th", null, "When"), !cust ? h("th", null, "Visibility") : null, h("th"))),
      h("tbody", null, fs.map(f => h("tr", null,
        h("td", null, h("div", { class:"split" }, h("span", { class:"fileic " + f.kind }, icon(f.kind === "doc" ? "file" : "link", "sm")),
          h("div", { class:"grow" }, h("a", { href:f.kind === "link" ? f.url : "javascript:void 0", target:f.kind === "link" ? "_blank" : null, rel:"noopener",
            onclick:f.kind === "doc" ? () => docModal(f, viewer) : null, style:"font-weight:500;color:var(--text)" }, f.name),
            h("div", { class:"faint", style:"font-size:11.5px" }, f.kind === "doc" ? "Document" : f.url)))),
        h("td", null, whoRow(f.author_id)), h("td", { class:"mono faint", style:"font-size:11.5px" }, fmtAgo(f.at)),
        !cust ? h("td", null, h("button", { class:"chk-l", onclick:() => { update("files", f.id, { private:!f.private }); commit(); } }, icon(f.private ? "lock" : "eye", "sm"), f.private ? "Private" : "Shared")) : null,
        h("td", { style:"text-align:right" }, !cust || f.author_id === viewer.id ? h("button", { class:"iconbtn", title:"Delete", onclick:() => confirmBox("Delete “" + f.name + "”?", "This can't be undone.", "Delete", () => { remove("files", f.id); commit(); }, true) }, icon("trash", "sm")) : null)))))
      : empty("No files yet."))];
}
function fileModal(p, kind, viewer){
  viewer = viewer || me();
  openModal(() => {
    const n = h("input", { class:"inp", placeholder:kind === "doc" ? "e.g. Cutover runbook" : "e.g. Supplier price list" });
    const u = h("input", { class:"inp", placeholder:"https://…" });
    const pv = h("input", { type:"checkbox" });
    const ok = () => {
      if(!n.value.trim() || (kind === "link" && !u.value.trim())) return;
      const f = insert("files", { project_id:p.id, name:n.value.trim(), kind, url:kind === "link" ? u.value.trim() : "", body:"", private:!isCustomer(viewer) && pv.checked, author_id:viewer.id, at:nowISO() });
      logAct(p.id, "", "added “" + f.name + "” to files", viewer); closeModal(); commit();
      if(kind === "doc") docModal(f, viewer);
    };
    return [modalHead(kind === "doc" ? "New document" : "Add a link"), h("div", { class:"modal-b" },
      h("div", { class:"fld" }, h("label", null, "Name"), n), kind === "link" ? h("div", { class:"fld" }, h("label", null, "URL"), u) : null,
      !isCustomer(viewer) ? h("label", { class:"chk-l" }, pv, "Private — only your team") : null),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:ok }, kind === "doc" ? "Create" : "Add"))];
  }, "narrow");
}
function docModal(f, viewer){
  viewer = viewer || me();
  let editing = !isCustomer(viewer) && !f.body;
  openModal(redraw => {
    const cur = byId("files", f.id) || f;
    return [modalHead(cur.name, (cur.private ? "Private · " : "") + "Updated " + fmtAgo(cur.updated_at)),
      h("div", { class:"modal-b" }, editing
        ? richEditor(cur.body, v => { update("files", f.id, { body:v }); saveDb(); }, { smartfill:true, placeholder:"Start writing. SmartFill fields fill in from the live project." })
        : h("div", { class:"rich", style:"padding:4px 2px;min-height:120px", html:smartFill(cleanHTML(cur.body), cur.project_id) || "<p class='faint'>Empty document.</p>" })),
      h("div", { class:"modal-f" }, h("span", { class:"grow sub", style:"font-size:12px" }, editing ? "Saves as you type. {{fields}} fill in when viewed." : ""),
        !isCustomer(viewer) ? h("button", { class:"btn", onclick:() => { editing = !editing; redraw(); } }, editing ? "Preview" : "Edit") : null,
        h("button", { class:"btn primary", onclick:() => { closeModal(); commit(); } }, "Done"))];
  }, "wide");
}

/* ---------------- updates ---------------- */
function updateItem(u){
  return h("div", { class:"update" }, h("div", { class:"hd" }, avatar(u.author_id, "sm"), h("b", null, userName(u.author_id)), h("span", null, fmtAgo(u.at)),
    u.private ? h("span", { class:"only" }, icon("lock", "xs"), "Internal") : null), h("div", { class:"bd" }, u.body));
}
function summaryText(p){
  const hl = health(p.id), next = hl.milestones.find(m => m.status !== "Completed");
  return "As of " + fmtDY(todayISO()) + ": " + hl.pct + "% complete (" + hl.done.length + " of " + hl.tasks.length + " tasks)" +
    (hl.overdue.length ? ", " + hl.overdue.length + " overdue" : "") + (hl.blocked.length ? ", " + hl.blocked.length + " blocked" : "") + "." +
    (next ? " Next milestone: " + next.name + " on " + fmtDY(next.due) + "." : "");
}
function tabUpdates(p){
  const ups = rows("updates", u => u.project_id === p.id).sort(by(u => u.at)).reverse();
  const ta = h("textarea", { class:"ta", placeholder:"What changed, what's next, what you need from the customer", value:drafts["upd:" + p.id] || "", oninput:e => drafts["upd:" + p.id] = e.target.value });
  const pv = h("input", { type:"checkbox" });
  return h("div", { class:"grid g-main" },
    card("Posted updates", plural(ups.length, "update"), ups.length ? ups.map(updateItem) : empty("Nothing posted yet.")),
    card("Post an update", null, [ta,
      h("div", { class:"split", style:"margin-top:10px;flex-wrap:wrap" },
        h("button", { class:"btn sm", onclick:() => { ta.value = (ta.value ? ta.value + "\n\n" : "") + summaryText(p); drafts["upd:" + p.id] = ta.value; ta.focus(); } }, "Insert project summary"),
        h("label", { class:"chk-l" }, pv, "Internal only"), h("span", { class:"grow" }),
        h("button", { class:"btn primary sm", onclick:() => { if(!ta.value.trim()) return;
          insert("updates", { project_id:p.id, author_id:me().id, body:ta.value.trim(), private:pv.checked, at:nowISO() });
          if(!pv.checked) (p.customer_ids || []).forEach(c => notify(c, me().name + " posted a project update", "#/portal/" + p.id + "/updates"));
          drafts["upd:" + p.id] = ""; commit(); toast("Update posted"); } }, "Post"))]));
}

/* ---------------- settings ---------------- */
function tabSettings(p){
  const fld = (label, node, hint) => h("div", { class:"fld" }, h("label", null, label), node, hint ? h("div", { class:"hint" }, hint) : null);
  const set = (k, v) => { update("projects", p.id, { [k]:v }); commit(); };
  const setF = (k, v) => { update("projects", p.id, { fields:Object.assign({}, p.fields, { [k]:v }) }); commit(); };
  const team = rows("users", u => u.type === "TEAM"), tabs = p.portal_tabs || {};
  const tabRow = (k, label, fixed) => h("label", { class:"chk-l", style:"display:flex;padding:5px 0" },
    h("input", { type:"checkbox", checked:fixed || tabs[k] !== false, disabled:fixed, onchange:e => set("portal_tabs", Object.assign({}, tabs, { [k]:e.target.checked })) }), label, fixed ? h("span", { class:"faint", style:"font-size:11.5px" }, " — always on") : null);
  return h("div", { class:"grid g2" },
    card("Project details", null, [
      fld("Name", h("input", { class:"inp", value:p.name, onchange:e => e.target.value.trim() && set("name", e.target.value.trim()) })),
      h("div", { class:"row" }, fld("Owner", sel(team.map(u => [u.id, u.name]), p.owner_id, v => set("owner_id", v))), fld("Status", sel(PROJECT_STATUSES, p.status, v => set("status", v)))),
      h("div", { class:"row" }, fld("Start", dateInp(p.start, v => set("start", v))), fld("Due", dateInp(p.due, v => set("due", v)))),
      fld("Our team", h("div", null, team.map(u => h("label", { class:"chk-l", style:"display:flex;padding:3px 0" },
        h("input", { type:"checkbox", checked:(p.team_ids || []).indexOf(u.id) > -1, onchange:e => set("team_ids", e.target.checked ? uniq((p.team_ids || []).concat(u.id)) : (p.team_ids || []).filter(x => x !== u.id)) }), u.name, h("span", { class:"faint" }, " · " + u.role)))))]),
    h("div", { class:"grid", style:"align-content:start" },
      card("Commercials", null, [
        h("div", { class:"row" }, fld("Project fee ($)", h("input", { class:"inp", type:"number", value:(p.fields || {}).fee || "", onchange:e => setF("fee", +e.target.value || 0) })),
          fld("ARR ($)", h("input", { class:"inp", type:"number", value:(p.fields || {}).arr || "", onchange:e => setF("arr", +e.target.value || 0) }))),
        h("div", { class:"row" }, fld("Budget hours", h("input", { class:"inp", type:"number", value:(p.fields || {}).budget_hours || "", onchange:e => setF("budget_hours", +e.target.value || 0) })),
          fld("Billing", sel(["Fixed fee","Time & material","Subscription","Non-billable"], (p.fields || {}).billing || "Fixed fee", v => setF("billing", v))))], { internal:true, only:"Only your team" }),
      card("Customer portal", null, [
        h("p", { class:"sub", style:"margin-bottom:8px" }, "Which tabs the customer sees. Private phases, tasks, files and messages are always hidden."),
        tabRow("plan", "Plan", true), tabRow("overview", "Home & key information"), tabRow("files", "Files"), tabRow("updates", "Project updates"), tabRow("chat", "Chat"),
        fld("Welcome message", h("textarea", { class:"ta", value:p.portal_welcome || "", onchange:e => set("portal_welcome", e.target.value) }))]),
      card("Project actions", null, h("div", { class:"acts" },
        h("button", { class:"btn", onclick:() => textModal("Save as template", "Template name", p.name + " template", v => { const t = saveAsTemplate(p.id, v); commit(); toast("Saved “" + v + "” — dates became offsets, people became roles"); go("templates/" + t.id); }) }, icon("copy", "sm"), "Save as template"),
        h("button", { class:"btn", onclick:() => { set("archived", !p.archived); toast(p.archived ? "Restored" : "Archived"); } }, icon("archive", "sm"), p.archived ? "Restore" : "Archive"),
        h("button", { class:"btn danger", onclick:() => confirmBox("Delete this project?", "Deletes the project with all its phases, tasks, messages and files. This can't be undone.", "Delete project", () => {
          ["phases","tasks","deps","approvals","messages","files","updates","time_entries","activity"].forEach(c => rows(c, x => x.project_id === p.id).forEach(x => remove(c, x.id)));
          remove("projects", p.id); commit(); go("projects"); }, true) }, icon("trash", "sm"), "Delete")))));
}
function inviteModal(p){
  openModal(() => {
    const a = byId("accounts", p.account_id);
    const existing = rows("users", u => u.account_id === p.account_id && (p.customer_ids || []).indexOf(u.id) === -1);
    const n = h("input", { class:"inp", placeholder:"Full name" }), e = h("input", { class:"inp", placeholder:"name@" + (a.domain || "company.com") }), ro = h("input", { class:"inp", placeholder:"e.g. Ops Lead" });
    const addTo = id => { update("projects", p.id, { customer_ids:uniq((p.customer_ids || []).concat(id)) }); logAct(p.id, "", "invited " + userName(id) + " to the portal"); };
    return [modalHead("Invite a customer contact", "They get the customer portal: the plan, files and updates you share. Nothing private."),
      h("div", { class:"modal-b" },
        existing.length ? [h("div", { class:"lab" }, "Already at " + a.name), existing.map(u => h("div", { class:"lrow" }, avatar(u), h("span", { class:"grow" }, u.name + " · " + u.role),
          h("button", { class:"btn sm", onclick:() => { addTo(u.id); closeModal(); commit(); toast(u.name + " added"); } }, "Add"))), h("div", { class:"hr" })] : null,
        h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Name"), n), h("div", { class:"fld" }, h("label", null, "Role"), ro)),
        h("div", { class:"fld" }, h("label", null, "Email"), e)),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => {
        if(!n.value.trim()) return;
        const u = insert("users", { name:n.value.trim(), type:"CUSTOMER", role:ro.value.trim() || "Customer", account_id:p.account_id, email:e.value.trim(), capacity_min:0, status:"INVITED" });
        addTo(u.id); closeModal(); commit(); toast("Invited " + u.name + " — they can open the portal now"); } }, "Send invite"))];
  });
}

/* ---------------- task drawer ---------------- */
let lastDrawer = null, drawerNote = null;
function renderDrawer(tid, portal){
  const dr = $("ln-drawer"), sc = $("ln-scrim");
  const t = tid && byId("tasks", tid);
  const viewer = portal ? portalViewer() : me();
  if(!t || (portal && !visibleTo(viewer, "tasks", t))){ dr.classList.remove("open"); sc.classList.remove("open"); lastDrawer = null; return; }
  const keep = lastDrawer === tid ? keepScroll(dr) : null;
  if(lastDrawer !== tid) drawerNote = null;
  dr.innerHTML = ""; add(dr, drawerBody(t, viewer, !!portal));
  if(keep) restoreScroll(dr, keep);
  lastDrawer = tid; dr.classList.add("open"); sc.classList.add("open");
}
function drawerBody(t, viewer, portal){
  const p = byId("projects", t.project_id), ph = byId("phases", t.phase_id), cust = isCustomer(viewer);
  const people = projectPeople(p), canEdit = !cust;
  const prop = (k, ic, v) => [h("div", { class:"k" }, icon(ic, "sm"), k), h("div", { class:"v" }, v)];
  const title = h("textarea", { class:"dr-title", rows:1, value:t.name, readonly:!canEdit,
    oninput:e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; },
    onchange:e => { const v = e.target.value.trim(); if(v && v !== t.name){ update("tasks", t.id, { name:v }); logAct(t.project_id, t.id, "renamed a task to “" + v + "”"); commit(); } } });
  setTimeout(() => { title.style.height = title.scrollHeight + "px"; }, 0);
  const waits = rows("deps", d => d.task_id === t.id), blocking = rows("deps", d => d.blocked_by_id === t.id);
  const aps = rows("approvals", a => a.task_id === t.id && visibleTo(viewer, "approvals", a) && (!cust || a.type !== "Internal")).sort(by(a => a.created_at)).reverse();
  const logged = rows("time_entries", e => e.task_id === t.id).reduce((s, e) => s + e.minutes, 0);
  const subs = subtasks(t.id).filter(s => visibleTo(viewer, "tasks", s));
  const acts = rows("activity", a => a.task_id === t.id).sort(by(a => a.at)).reverse().slice(0, 12);
  const sec = (title, extra) => h("div", { class:"dsec-h" }, h("h4", null, title), h("div", { class:"rule" }), extra || null);

  const assignees = h("div", { class:"v" }, (t.assignee_ids || []).map(id => h("span", { class:"lrow", style:"margin:0;padding:3px 8px 3px 4px;gap:6px" }, avatar(id, "sm"), h("span", { style:"font-size:12.5px" }, userName(id)),
      canEdit ? h("button", { class:"x", title:"Remove", onclick:() => { assignTask(t, t.assignee_ids.filter(x => x !== id)); commit(); } }, icon("x", "xs")) : null)),
    canEdit ? sel([["", "+ Add"]].concat(people.filter(u => (t.assignee_ids || []).indexOf(u.id) === -1).map(u => [u.id, u.name + (isCustomer(u) ? " (customer)" : "")])), "",
      v => { if(v){ assignTask(t, (t.assignee_ids || []).concat(v)); commit(); } }, "bare") : null);

  return [
    h("div", { class:"dr-h" },
      h("div", { class:"grow" },
        h("div", { class:"ctx" }, portal ? null : h("a", { href:"#/projects/" + p.id + "/plan" }, p.name), portal ? null : h("span", { class:"dot-sep" }, "›"), h("span", null, ph ? ph.name : ""),
          t.type === "MILESTONE" ? pill("Milestone", "hold") : null, t.private ? h("span", { class:"only" }, icon("lock", "xs"), "Private") : null),
        title),
      h("button", { class:"iconbtn", onclick:closeTaskDrawer, "aria-label":"Close" }, icon("x"))),
    h("div", { class:"dr-b", "data-sk":"drawer" },
      drawerNote ? h("div", { class:"note-box" + (drawerNote.kind ? " " + drawerNote.kind : "") }, drawerNote.text) : null,
      h("div", { class:"props" },
        prop("Status", "check", sel(TASK_STATUSES, t.status, v => { setTaskStatus(t, v); commit(); })),
        [h("div", { class:"k" }, icon("users", "sm"), "Assignees"), assignees],
        prop(t.type === "MILESTONE" ? "Date" : "Dates", "calendar", canEdit ? (t.type === "MILESTONE"
          ? dateInp(t.due, v => { const m = setTaskDates(t, v, v); movedNote(m); commit(); })
          : [dateInp(t.start, v => { const m = setTaskDates(t, v, t.due); movedNote(m); commit(); }), h("span", { class:"faint" }, "→"),
             dateInp(t.due, v => { const m = setTaskDates(t, t.start, v); movedNote(m); commit(); })])
          : h("span", { class:isOverdue(t) ? "red" : "" }, fmtRange(t.start, t.due))),
        (t.start_actual || t.due_actual) ? prop("Actual", "clock", h("span", { class:"mono", style:"font-size:12px" }, (t.start_actual ? "started " + fmtD(t.start_actual) : "") + (t.due_actual ? " · completed " + fmtD(t.due_actual) : ""))) : null,
        canEdit ? prop("Effort", "clock", [h("input", { class:"inp", type:"number", min:0, step:0.5, style:"width:90px", value:t.effort_min ? t.effort_min / 60 : "",
          onchange:e => { update("tasks", t.id, { effort_min:Math.round((+e.target.value || 0) * 60) }); commit(); } }), h("span", { class:"faint" }, "h planned · " + fmtMins(logged) + " logged"),
          h("button", { class:"btn sm", onclick:() => logTimeModal(t) }, "Log time")]) : null,
        canEdit ? prop("Phase", "board", sel(projPhases(p.id).map(x => [x.id, x.name]), t.phase_id, v => { const from = t.phase_id; update("tasks", t.id, { phase_id:v }); recalcPhase(from); recalcPhase(v); commit(); })) : null,
        canEdit ? prop("Type", "diamond", sel([["TASK","Task"],["MILESTONE","Milestone"]], t.type, v => { update("tasks", t.id, { type:v }); if(v === "MILESTONE") setTaskDates(t, t.due, t.due); commit(); })) : null,
        canEdit ? prop("Flags", "flag", [h("label", { class:"chk-l" }, h("input", { type:"checkbox", checked:!!t.at_risk, onchange:e => { update("tasks", t.id, { at_risk:e.target.checked }); logAct(p.id, t.id, (e.target.checked ? "marked “" : "cleared at-risk on “") + t.name + (e.target.checked ? "” at risk" : "”")); commit(); } }), "At risk"),
          h("label", { class:"chk-l", title:"Private tasks are hidden from the customer" }, h("input", { type:"checkbox", checked:!!t.private, onchange:e => { update("tasks", t.id, { private:e.target.checked }); commit(); } }), icon("lock", "xs"), "Private")]) : null),

      sec("Description"),
      canEdit ? richEditor(t.description, v => { if(v !== (byId("tasks", t.id) || {}).description){ update("tasks", t.id, { description:v }); saveDb(); } }, { placeholder:"Add details, a checklist, links…" })
        : h("div", { class:"rich", html:cleanHTML(t.description) || "<p class='faint'>No description.</p>" }),

      sec("Subtasks", h("span", { class:"mono faint", style:"font-size:10.5px" }, subs.filter(s => s.status === "Completed").length + "/" + subs.length)),
      subs.map(s => h("div", { class:"lrow" }, statusCircle(s, canEdit ? undefined : false), h("span", { class:"grow", style:s.status === "Completed" ? "text-decoration:line-through;color:var(--faint)" : "" }, s.name),
        canEdit ? h("button", { class:"x", onclick:() => { remove("tasks", s.id); commit(); } }, icon("x", "xs")) : null)),
      canEdit ? h("input", { class:"inp", placeholder:"+ Add a subtask and press Enter", onkeydown:e => { if(e.key === "Enter" && e.target.value.trim()){
        insert("tasks", { project_id:t.project_id, phase_id:t.phase_id, parent_id:t.id, name:e.target.value.trim(), description:"", type:"TASK", status:"To do", priority:"", at_risk:false,
          start:"", due:"", start_actual:"", due_actual:"", assignee_ids:(t.assignee_ids || []).slice(0, 1), follower_ids:[], effort_min:0, private:t.private, csat_enabled:false });
        e.target.value = ""; saveDb(); render(); const n = $("ln-drawer").querySelector('input[placeholder^="+ Add a subtask"]'); if(n) n.focus(); } } }) : null,

      !cust ? [sec("Dependencies"),
        waits.length ? h("div", { class:"lab" }, "Waiting on") : null,
        waits.map(d => { const b = byId("tasks", d.blocked_by_id); return b ? h("div", { class:"lrow" }, statusCircle(b, false),
          h("a", { class:"grow", href:"javascript:void 0", onclick:() => openTask(b.id), style:"color:var(--text)" }, b.name),
          h("span", { class:"mono faint", style:"font-size:11px" }, "ends " + fmtD(b.due)),
          h("button", { class:"x", title:"Remove — dates stay where they are", onclick:() => { remove("deps", d.id); logAct(p.id, t.id, "removed a dependency on “" + b.name + "”"); commit(); } }, icon("x", "xs"))) : null; }),
        sel([["", "+ Make this wait on another task…"]].concat(projTasks(p.id, x => x.id !== t.id && !wouldCycle(t.id, x.id) && !waits.some(d => d.blocked_by_id === x.id))
          .sort(by(x => x.due || "")).map(x => [x.id, x.name + " — ends " + fmtD(x.due)])), "", v => {
            if(!v) return; const res = addDep(t.id, v);
            if(res.error){ drawerNote = { text:res.error, kind:"warn" }; render(); return; }
            movedNote(res.moved, true); commit(); }),
        blocking.length ? [h("div", { class:"lab", style:"margin-top:10px" }, "Blocking"), blocking.map(d => { const b = byId("tasks", d.task_id); return b ? h("div", { class:"lrow" }, statusCircle(b, false),
          h("a", { class:"grow", href:"javascript:void 0", onclick:() => openTask(b.id), style:"color:var(--text)" }, b.name), h("span", { class:"mono faint", style:"font-size:11px" }, "starts " + fmtD(b.start))) : null; })] : null] : null,

      sec("Approvals", canEdit ? h("button", { class:"link", onclick:() => approvalModal(t) }, "Request approval") : null),
      aps.length ? aps.map(a => approvalCard(a, viewer)) : h("p", { class:"faint", style:"font-size:12.5px" }, "No approvals on this task."),

      sec("Conversation"),
      convo(p, "task:" + t.id, { viewer }),

      !cust && acts.length ? [sec("Activity"), h("ul", { class:"activity" }, acts.map(a => h("li", null, h("span", { class:"t" }, fmtAgo(a.at)), h("span", null, h("b", { style:"color:var(--text);font-weight:500" }, firstName(a.user_id)), " ", a.text))))] : null,
      canEdit ? h("div", { style:"margin-top:24px" }, h("button", { class:"btn danger sm", onclick:() => confirmBox("Delete “" + t.name + "”?", "Its subtasks, links and approvals go with it.", "Delete task", () => {
        subtasks(t.id).forEach(s => remove("tasks", s.id)); rows("deps", d => d.task_id === t.id || d.blocked_by_id === t.id).forEach(d => remove("deps", d.id));
        rows("approvals", a => a.task_id === t.id).forEach(a => remove("approvals", a.id)); remove("tasks", t.id); recalcPhase(t.phase_id); closeTaskDrawer(); commit(); }, true) }, icon("trash", "sm"), "Delete task")) : null)
  ];
}
function movedNote(moved, linked){
  if(moved && moved.length) drawerNote = { text:(linked ? "Linked. " : "") + plural(moved.length, "task") + " moved to start after their blocker: " + moved.map(m => m.name + " → " + fmtD(m.start)).join(", "), kind:"" };
  else if(linked) drawerNote = { text:"Linked. The dates already fit, so nothing moved.", kind:"ok" };
}
function approvalCard(a, viewer){
  const mine = (a.approver_ids || []).indexOf(viewer.id) > -1, req = a.status === "REQUESTED";
  return h("div", { class:"appr" + (req ? " req" : "") },
    h("div", { class:"top" }, icon("flag", "sm"), h("span", { class:"grow" }, h("b", null, req ? "Waiting on " : a.status === "APPROVED" ? "Approved by " : "Rejected by "),
      req ? (a.approver_ids || []).map(userName).join(", ") : userName(a.responded_by)),
      a.type === "Internal" ? h("span", { class:"only" }, icon("lock", "xs"), "Internal") : null,
      req ? h("span", { class:"chip " + (a.due < todayISO() ? "red" : "") }, "due " + fmtD(a.due)) : h("span", { class:"chip jade" }, fmtAgo(a.responded_at))),
    a.note ? h("p", { class:"sub", style:"margin-top:6px;font-size:12.5px" }, "“" + a.note + "” — " + firstName(a.requested_by)) : null,
    req && mine ? h("div", { class:"acts", style:"margin-top:9px" },
      h("button", { class:"btn jade sm", onclick:() => respondApproval(a, "APPROVED", viewer) }, icon("check", "sm"), "Approve"),
      h("button", { class:"btn sm", onclick:() => respondApproval(a, "REJECTED", viewer) }, "Reject")) : null);
}
function respondApproval(a, status, viewer){
  const t = byId("tasks", a.task_id);
  confirmBox(status === "APPROVED" ? "Confirm approval" : "Reject this?", "“" + t.name + "” — " + (status === "APPROVED" ? "your approval is recorded with your name and the time." : "the team will be told it needs another pass."),
    status === "APPROVED" ? "Confirm approval" : "Reject", () => {
      update("approvals", a.id, { status, responded_by:viewer.id, responded_at:nowISO() });
      logAct(t.project_id, t.id, (status === "APPROVED" ? "approved “" : "rejected “") + t.name + "”", viewer);
      notify(a.requested_by, viewer.name + (status === "APPROVED" ? " approved “" : " rejected “") + t.name + "”", "#/projects/" + t.project_id + "/plan?t=" + t.id);
      commit(); toast(status === "APPROVED" ? "Approved" : "Rejected");
    }, status !== "APPROVED");
}
function approvalModal(t){
  const p = byId("projects", t.project_id), people = projectPeople(p).filter(u => u.id !== me().id);
  const pre = (t.assignee_ids || []).filter(id => isCustomer(byId("users", id)));
  const picked = {}; (pre.length ? pre : [p.owner_id !== me().id ? p.owner_id : (people[0] || {}).id]).forEach(id => id && (picked[id] = 1));
  openModal(redraw => {
    const due = h("input", { type:"date", class:"inp", value:addDays(todayISO(), 3) });
    const note = h("textarea", { class:"ta", placeholder:"What are you asking them to approve?" });
    const anyCust = Object.keys(picked).some(id => isCustomer(byId("users", id)));
    return [modalHead("Request approval", "“" + t.name + "”"), h("div", { class:"modal-b" },
      h("div", { class:"fld" }, h("label", null, "Approvers"), people.map(u => h("label", { class:"chk-l", style:"display:flex;padding:3px 0" },
        h("input", { type:"checkbox", checked:!!picked[u.id], onchange:e => { if(e.target.checked) picked[u.id] = 1; else delete picked[u.id]; redraw(); } }), avatar(u, "sm"), u.name, h("span", { class:"faint" }, " · " + (isCustomer(u) ? "customer" : u.role))))),
      h("div", { class:"fld" }, h("label", null, "Respond by"), due), h("div", { class:"fld" }, h("label", null, "Note"), note),
      anyCust ? h("div", { class:"note-box" }, "A customer approver sees this in their portal under Action items.") : null),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => {
        const ids = Object.keys(picked); if(!ids.length) return;
        insert("approvals", { task_id:t.id, project_id:t.project_id, approver_ids:ids, requested_by:me().id, due:due.value, status:"REQUESTED",
          type:anyCust ? "Shared" : "Internal", note:note.value.trim(), responded_by:"", responded_at:"" });
        ids.forEach(id => notify(id, me().name + " requested your approval on “" + t.name + "”", isCustomer(byId("users", id)) ? "#/portal/" + p.id + "/actions" : "#/projects/" + p.id + "/plan?t=" + t.id));
        logAct(p.id, t.id, "requested approval on “" + t.name + "” from " + ids.map(userName).join(", "));
        closeModal(); commit(); toast("Approval requested"); } }, "Request"))];
  }, "narrow");
}
function logTimeModal(t, after){
  openModal(() => {
    const d = h("input", { type:"date", class:"inp", value:todayISO() }), hrs = h("input", { class:"inp", placeholder:"1:30 or 1.5" });
    const n = h("input", { class:"inp", placeholder:"What you did (optional)" }), b = h("input", { type:"checkbox", checked:true });
    const ok = () => { const m = parseHours(hrs.value); if(!m) return; logTime(t.id, d.value, m, n.value.trim(), b.checked); closeModal(); commit(); toast("Logged " + fmtMins(m) + " on “" + t.name + "”"); if(after) after(); };
    hrs.addEventListener("keydown", e => { if(e.key === "Enter") ok(); });
    return [modalHead("Log time", t.name + " · " + (byId("projects", t.project_id) || {}).name), h("div", { class:"modal-b" },
      h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Hours"), hrs), h("div", { class:"fld" }, h("label", null, "Date"), d)),
      h("div", { class:"fld" }, h("label", null, "Notes"), n), h("label", { class:"chk-l" }, b, "Billable")),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:ok }, "Log time"))];
  }, "narrow");
}
function quickTaskModal(pre){
  pre = Object.assign({}, pre);
  openModal(redraw => {
    const ps = rows("projects", p => !p.archived && p.status !== "Completed");
    if(!pre.project_id) pre.project_id = (ps[0] || {}).id;
    const p = byId("projects", pre.project_id), phs = p ? projPhases(p.id) : [];
    if(!pre.phase_id || !phs.find(x => x.id === pre.phase_id)) pre.phase_id = (phs.find(x => x.status !== "Completed") || phs[0] || {}).id;
    const n = h("input", { class:"inp", placeholder:"What needs doing?", value:pre.name || "", oninput:e => pre.name = e.target.value });
    const ok = () => {
      if(!(pre.name || "").trim() || !p || !pre.phase_id) return;
      const due = pre.due || todayISO();
      const t = insert("tasks", { project_id:p.id, phase_id:pre.phase_id, parent_id:"", name:pre.name.trim(), description:"", type:"TASK", status:"To do", priority:"", at_risk:false,
        start:pre.start || due, due, start_actual:"", due_actual:"", assignee_ids:[], follower_ids:[], effort_min:0, private:false, csat_enabled:false });
      assignTask(t, [pre.assignee || me().id]); logAct(p.id, t.id, "added “" + t.name + "”"); recalcPhase(t.phase_id);
      closeModal(); commit(); toast("Task added to " + p.name); };
    n.addEventListener("keydown", e => { if(e.key === "Enter") ok(); });
    return [modalHead("New task"), h("div", { class:"modal-b" },
      h("div", { class:"fld" }, h("label", null, "Task"), n),
      h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Project"), sel(ps.map(x => [x.id, x.name]), pre.project_id, v => { pre.project_id = v; pre.phase_id = ""; redraw(); })),
        h("div", { class:"fld" }, h("label", null, "Phase"), sel(phs.map(x => [x.id, x.name]), pre.phase_id, v => pre.phase_id = v))),
      h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Assignee"), sel(p ? projectPeople(p).map(u => [u.id, u.name]) : [], pre.assignee || me().id, v => pre.assignee = v)),
        h("div", { class:"fld" }, h("label", null, "Due"), dateInp(pre.due || todayISO(), v => pre.due = v)))),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:ok }, "Add task"))];
  }, "narrow");
}
