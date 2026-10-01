/* =====================================================================
   Screens: home, accounts, projects + wizard, all tasks, templates,
   timesheets, settings
   ===================================================================== */

function pageHead(eyebrow, title, sub, actions){
  return h("div", { class:"phead" }, h("div", { class:"grow" }, eyebrow ? h("div", { class:"eyebrow" }, eyebrow) : null, h("h1", { class:"title" }, title), sub ? h("p", { class:"sub" }, sub) : null),
    actions ? h("div", { class:"acts" }, actions) : null);
}
function liveProject(t){ const p = byId("projects", t.project_id); return p && !p.archived; }

/* ---------------- home ---------------- */
function viewHome(){
  const u = me(), T = todayISO(), ws = weekStart(T);
  const mine = rows("tasks", t => (t.assignee_ids || []).indexOf(u.id) > -1 && !t.parent_id && liveProject(t));
  const open = mine.filter(t => t.status !== "Completed").sort(by(t => t.due || "9999"));
  const overdue = open.filter(isOverdue), week = open.filter(t => t.due && t.due >= T && t.due <= addDays(ws, 6));
  const aps = rows("approvals", a => a.status === "REQUESTED" && (a.approver_ids || []).indexOf(u.id) > -1);
  const hrs = myEntries(u.id, ws, addDays(ws, 6)).reduce((s, e) => s + e.minutes, 0);
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const owned = rows("projects", p => p.owner_id === u.id && !p.archived && p.status !== "Completed");
  const byProj = {}; open.forEach(t => (byProj[t.project_id] = byProj[t.project_id] || []).push(t));
  crumbs = [["Home"]];
  return h("div", { class:"page" },
    pageHead(DOW[new Date().getDay()] + " · " + fmtDY(T), greet + ", " + u.name.split(" ")[0], "Here's what's on your plate across every project.",
      [h("a", { class:"btn", href:"#/myday" }, icon("sun", "sm"), "Open My Day"), h("button", { class:"btn primary", onclick:() => quickTaskModal({}) }, icon("plus", "sm"), "New task")]),
    h("div", { class:"tiles" },
      tile(open.length, "Open tasks"), tile(overdue.length, "Overdue", overdue.length ? "bad" : ""), tile(week.length, "Due this week"),
      tile(aps.length, "Waiting on your approval", aps.length ? "warn" : ""), tile(fmtMins(hrs), "Hours this week", "", () => go("timesheets"))),
    h("div", { class:"grid g-main" },
      h("div", { class:"grid", style:"align-content:start" },
        aps.length ? card("Waiting on your approval", aps.length, aps.map(a => { const t = byId("tasks", a.task_id); return h("div", null,
          h("div", { class:"split", style:"margin-bottom:4px" }, h("a", { href:"javascript:void 0", onclick:() => openTask(t.id), style:"font-weight:500;color:var(--text)" }, t.name),
            h("span", { class:"faint", style:"font-size:12px" }, (byId("projects", t.project_id) || {}).name)), approvalCard(a, u)); }), { icon:"flag" }) : null,
        card("My tasks", plural(open.length, "open task"), Object.keys(byProj).length ? Object.keys(byProj).map(pid => h("div", { style:"margin-bottom:10px" },
          h("div", { class:"lab", style:"margin:4px 0 2px" }, (byId("projects", pid) || {}).name),
          h("ul", { class:"tl" }, byProj[pid].slice(0, 8).map(t => taskLine(t))),
          byProj[pid].length > 8 ? h("a", { class:"link", href:"#/tasks" }, "+" + (byProj[pid].length - 8) + " more") : null)) : empty("Nothing assigned to you. Enjoy it."), { icon:"tasks" })),
      h("div", { class:"grid", style:"align-content:start" },
        card("Projects you own", owned.length, owned.length ? h("ul", { class:"tl" }, owned.map(p => { const hl = health(p.id); return h("li", { class:"click", onclick:() => go("projects/" + p.id + "/overview") },
          acctLogo(p.account_id), h("div", { class:"grow" }, h("div", { class:"nm" }, p.name), h("div", { class:"ctx" }, (byId("accounts", p.account_id) || {}).name + " · " + hl.pct + "%")),
          h("span", { class:"chip " + (hl.overdue.length ? "red" : "") }, hl.overdue.length ? hl.overdue.length + " overdue" : p.status)); })) : empty("You don't own any active projects.")),
        card("Recently assigned to you", null, h("ul", { class:"tl" }, mine.slice().sort(by(t => t.updated_at)).reverse().slice(0, 6).map(t => taskLine(t)))))));
}

/* ---------------- accounts ---------------- */
function viewAccounts(r){
  if(r.parts[1]) return viewAccount(byId("accounts", r.parts[1]));
  const acs = rows("accounts", a => a.kind !== "vendor").sort(by(a => a.name));
  crumbs = [["Accounts"]];
  return h("div", { class:"page" },
    pageHead("Customers", "Accounts", "Every customer you deliver for, with their projects and how they're going.",
      h("button", { class:"btn primary", onclick:accountModal }, icon("plus", "sm"), "New account")),
    h("div", { class:"card" }, h("table", { class:"tbl" },
      h("thead", null, h("tr", null, h("th", null, "Account"), h("th", null, "Projects"), h("th", null, "Contacts"), h("th", null, "Health"), h("th", { class:"num" }, "Fees"), h("th", null, "Next due"))),
      h("tbody", null, acs.map(a => {
        const ps = rows("projects", p => p.account_id === a.id && !p.archived), active = ps.filter(p => p.status !== "Completed");
        const late = active.filter(p => health(p.id).overdue.length).length;
        const fees = ps.reduce((s, p) => s + ((p.fields || {}).fee || 0), 0);
        const next = active.map(p => p.due).filter(Boolean).sort()[0];
        return h("tr", { class:"click", onclick:() => go("accounts/" + a.id) },
          h("td", null, h("div", { class:"split" }, acctLogo(a), h("div", null, h("div", { style:"font-weight:600" }, a.name), h("div", { class:"faint", style:"font-size:12px" }, a.industry || a.domain)))),
          h("td", null, active.length + " active", h("span", { class:"faint" }, " · " + ps.length + " total")),
          h("td", null, avatars(rows("users", u => u.account_id === a.id).map(u => u.id))),
          h("td", null, !active.length ? pill("No active work", "") : late ? pill(plural(late, "project") + " running late", "blocked", true) : pill("On track", "done", true)),
          h("td", { class:"num" }, fees ? "$" + fees.toLocaleString() : "—"),
          h("td", { class:"mono", style:"font-size:12px" }, fmtDY(next)));
      })))));
}
function viewAccount(a){
  if(!a) return h("div", { class:"page" }, empty("That account doesn't exist."));
  crumbs = [["Accounts", "#/accounts"], [a.name]];
  const ps = rows("projects", p => p.account_id === a.id).sort(by(p => p.start || "")).reverse();
  const contacts = rows("users", u => u.account_id === a.id);
  const active = ps.filter(p => !p.archived && p.status !== "Completed");
  const fees = ps.reduce((s, p) => s + ((p.fields || {}).fee || 0), 0), arr = ps.reduce((s, p) => s + ((p.fields || {}).arr || 0), 0);
  return h("div", { class:"page" },
    h("div", { class:"proj-h" }, acctLogo(a, "lg"), h("div", { class:"grow" }, h("div", { class:"eyebrow" }, "Account"), h("h1", null, a.name), h("p", { class:"sub" }, [a.industry, a.domain].filter(Boolean).join(" · "))),
      h("div", { class:"acts" }, h("button", { class:"btn primary", onclick:() => wizard({ account_id:a.id }) }, icon("plus", "sm"), "New project"))),
    h("div", { class:"tiles" }, tile(active.length, "Active projects"), tile(ps.length, "All projects"), tile(contacts.length, "Contacts"),
      tile(fees ? "$" + (fees / 1000).toFixed(0) + "k" : "—", "Project fees"), tile(arr ? "$" + (arr / 1000).toFixed(1) + "k" : "—", "ARR")),
    h("div", { class:"grid g-main" },
      card("Projects", ps.length, ps.length ? h("table", { class:"tbl" }, h("tbody", null, ps.map(p => { const hl = health(p.id); return h("tr", { class:"click", onclick:() => go("projects/" + p.id + "/overview") },
        h("td", null, h("div", { style:"font-weight:500" }, p.name), h("div", { class:"faint mono", style:"font-size:11px" }, fmtDY(p.start) + " → " + fmtDY(p.due))),
        h("td", null, statusPill(p.status)), h("td", { style:"width:140px" }, h("div", { class:"split" }, bar(hl.pct), h("span", { class:"mono faint", style:"font-size:11px" }, hl.pct + "%"))),
        h("td", null, hl.overdue.length ? h("span", { class:"chip red" }, hl.overdue.length + " overdue") : h("span", { class:"chip" }, hl.inferred))); }))) : empty("No projects yet."), { flush:true }),
      card("Contacts", contacts.length, [contacts.map(u => h("div", { style:"margin-bottom:10px" }, whoRow(u, u.role + (u.email ? " · " + u.email : "")))),
        h("button", { class:"btn sm", onclick:() => contactModal(a) }, icon("plus", "sm"), "Add contact")])));
}
function accountModal(){
  openModal(() => {
    const n = h("input", { class:"inp", placeholder:"Company name" }), d = h("input", { class:"inp", placeholder:"company.com" }), i = h("input", { class:"inp", placeholder:"e.g. Roofing · 2 branches" });
    return [modalHead("New account"), h("div", { class:"modal-b" }, h("div", { class:"fld" }, h("label", null, "Name"), n),
      h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Domain"), d), h("div", { class:"fld" }, h("label", null, "Industry / size"), i))),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => {
        if(!n.value.trim()) return; const a = insert("accounts", { name:n.value.trim(), domain:d.value.trim(), industry:i.value.trim(), logo_color:hashColor(n.value), kind:"customer" });
        closeModal(); commit(); go("accounts/" + a.id); } }, "Create"))];
  }, "narrow");
}
function contactModal(a, after){
  openModal(() => {
    const n = h("input", { class:"inp", placeholder:"Full name" }), e = h("input", { class:"inp", placeholder:"name@" + (a.domain || "company.com") }), r = h("input", { class:"inp", placeholder:"e.g. Ops Lead" });
    return [modalHead("Add a contact at " + a.name), h("div", { class:"modal-b" }, h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Name"), n), h("div", { class:"fld" }, h("label", null, "Role"), r)),
      h("div", { class:"fld" }, h("label", null, "Email"), e)),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => {
        if(!n.value.trim()) return; const u = insert("users", { name:n.value.trim(), type:"CUSTOMER", role:r.value.trim() || "Customer", account_id:a.id, email:e.value.trim(), capacity_min:0, status:"INVITED" });
        closeModal(); commit(); if(after) after(u); } }, "Add"))];
  }, "narrow");
}

/* ---------------- projects ---------------- */
let projFilter = { status:"active", owner:"", q:"" };
function viewProjects(r){
  if(r.parts[1]) return viewProject(r);
  crumbs = [["Projects"]];
  const team = rows("users", u => u.type === "TEAM");
  const ps = rows("projects", p => {
    if(projFilter.status === "active" && (p.archived || p.status === "Completed")) return false;
    if(projFilter.status === "archived" && !p.archived) return false;
    if(projFilter.status && ["active","archived"].indexOf(projFilter.status) === -1 && p.status !== projFilter.status) return false;
    if(projFilter.owner && p.owner_id !== projFilter.owner) return false;
    if(projFilter.q && (p.name + " " + (byId("accounts", p.account_id) || {}).name).toLowerCase().indexOf(projFilter.q.toLowerCase()) === -1) return false;
    return true;
  }).sort(by(p => p.due || "9999"));
  const pf = v => { Object.assign(projFilter, v); scheduleRender(); };
  return h("div", { class:"page" },
    pageHead("Delivery", "Projects", "Every implementation in flight, with how far along it is and what's slipping.",
      h("button", { class:"btn primary", onclick:() => wizard({}) }, icon("plus", "sm"), "New project")),
    h("div", { class:"filters" },
      sel([["active","Active"],["","All"]].concat(PROJECT_STATUSES.map(s => [s, s])).concat([["archived","Archived"]]), projFilter.status, v => pf({ status:v })),
      sel([["", "Any owner"]].concat(team.map(u => [u.id, u.name])), projFilter.owner, v => pf({ owner:v })),
      h("input", { class:"inp", style:"width:220px", placeholder:"Search projects", value:projFilter.q, oninput:e => pf({ q:e.target.value }) }),
      h("span", { class:"faint", style:"font-size:12.5px" }, plural(ps.length, "project"))),
    h("div", { class:"card" }, h("div", { class:"tbl-wrap" }, h("table", { class:"tbl" },
      h("thead", null, h("tr", null, h("th", null, "Project"), h("th", null, "Status"), h("th", null, "Owner"), h("th", null, "Start"), h("th", null, "Due"), h("th", null, "Progress"), h("th", null, "Health"), h("th", null, "Customer"))),
      h("tbody", null, ps.length ? ps.map(p => { const hl = health(p.id), a = byId("accounts", p.account_id) || {};
        return h("tr", { class:"click", onclick:() => go("projects/" + p.id + "/overview") },
          h("td", null, h("div", { class:"split" }, acctLogo(a), h("div", { style:"min-width:0" }, h("div", { style:"font-weight:600" }, p.name), h("div", { class:"faint", style:"font-size:12px" }, a.name)))),
          h("td", null, statusPill(p.status)), h("td", null, whoRow(p.owner_id, " ")),
          h("td", { class:"mono", style:"font-size:12px" }, fmtD(p.start)), h("td", { class:"mono", style:"font-size:12px" }, fmtD(p.due)),
          h("td", { style:"width:150px" }, h("div", { class:"split" }, bar(hl.pct), h("span", { class:"mono faint", style:"font-size:11px;width:34px" }, hl.pct + "%"))),
          h("td", null, h("div", { class:"acts", style:"gap:4px" }, hl.overdue.length ? h("span", { class:"chip red" }, hl.overdue.length + " overdue") : null,
            hl.blocked.length ? h("span", { class:"chip red" }, hl.blocked.length + " blocked") : null, hl.atRisk.length ? h("span", { class:"chip gold" }, hl.atRisk.length + " at risk") : null,
            !hl.overdue.length && !hl.blocked.length && !hl.atRisk.length ? h("span", { class:"chip jade" }, hl.inferred) : null)),
          h("td", null, avatars(p.customer_ids)));
      }) : h("tr", null, h("td", { colspan:8 }, empty("No projects match."))))))));
}

/* ---------------- new project wizard ---------------- */
function wizard(pre){
  const w = Object.assign({ step:1, account_id:"", newAccount:"", name:"", status:"Proposed", start:addDays(weekStart(todayISO()), 7), owner_id:me().id, visibility:"EVERYONE",
    tpls:[], roleMap:{}, team_ids:[me().id], customer_ids:[] }, pre);
  if(pre.template_id){ w.tpls = [{ id:pre.template_id, offset:0 }]; }
  const accts = rows("accounts", a => a.kind !== "vendor").sort(by(a => a.name));
  if(!w.account_id && !w.newAccount && accts[0]) w.account_id = accts[0].id;
  const team = rows("users", u => u.type === "TEAM");
  openModal(redraw => {
    const fld = (l, n, hint) => h("div", { class:"fld" }, h("label", null, l), n, hint ? h("div", { class:"hint" }, hint) : null);
    const steps = h("div", { class:"steps" }, [1, 2, 3].map(i => h("span", { class:i <= w.step ? "on" : "" })));
    let body;
    if(w.step === 1){
      body = [
        fld("Customer", h("div", { class:"row" }, sel(accts.map(a => [a.id, a.name]).concat([["__new", "+ New customer…"]]), w.account_id || "__new", v => { w.account_id = v === "__new" ? "" : v; redraw(); }),
          !w.account_id ? h("input", { class:"inp", placeholder:"New customer name", value:w.newAccount, oninput:e => { w.newAccount = e.target.value; } }) : null)),
        fld("Project name", h("input", { class:"inp", placeholder:"e.g. Field-ops platform rollout", value:w.name, oninput:e => { w.name = e.target.value; } })),
        h("div", { class:"row" }, fld("Status", sel(PROJECT_STATUSES, w.status, v => w.status = v)), fld("Start date", dateInp(w.start, v => { w.start = v; redraw(); })),
          fld("Owner", sel(team.map(u => [u.id, u.name]), w.owner_id, v => w.owner_id = v))),
        fld("Visibility", sel([["EVERYONE","Everyone on your team"],["MEMBERS","Only project members"]], w.visibility, v => w.visibility = v))];
    } else if(w.step === 2){
      const tps = rows("templates");
      const toggle = id => { const i = w.tpls.findIndex(x => x.id === id);
        if(i > -1) w.tpls.splice(i, 1);
        else { const prev = w.tpls.slice(-1)[0]; w.tpls.push({ id, offset:prev ? prev.offset + templateSpan(byId("templates", prev.id)) + 1 : 0 }); }
        redraw(); };
      body = [h("p", { class:"sub", style:"margin-bottom:12px" }, "Pick one or more. Stacked templates each start on their own day offset — by default, one after the other."),
        tps.map(t => { const on = w.tpls.find(x => x.id === t.id), n = t.phases.reduce((s, ph) => s + ph.tasks.length, 0);
          return h("label", { class:"pick" + (on ? " on" : "") }, h("input", { type:"checkbox", checked:!!on, onchange:() => toggle(t.id) }),
            h("div", { class:"grow" }, h("div", { style:"font-weight:600" }, t.name), h("div", { class:"sub", style:"font-size:12.5px" }, t.description),
              h("div", { class:"faint mono", style:"font-size:11px;margin-top:4px" }, plural(t.phases.length, "phase") + " · " + plural(n, "task") + " · runs " + plural(templateSpan(t) + 1, "day"))),
            on ? h("div", { onclick:e => e.preventDefault() }, h("div", { class:"lab" }, "Starts on day"),
              h("input", { class:"inp", type:"number", min:0, style:"width:80px", value:on.offset, onchange:e => { on.offset = Math.max(0, +e.target.value || 0); redraw(); } })) : null); }),
        !w.tpls.length ? h("div", { class:"note-box" }, "No template picked — you'll start with one empty phase.") : null];
    } else {
      const roles = uniq(w.tpls.flatMap(x => templateRoles(byId("templates", x.id))));
      const acc = w.account_id ? rows("users", u => u.account_id === w.account_id) : [];
      roles.forEach(r => { if(!(r in w.roleMap)){ const m = r === "Customer" ? acc[0] : team.find(u => u.role === r); w.roleMap[r] = m ? m.id : ""; } });
      if(!w.customer_ids.length && acc[0]) w.customer_ids = [acc[0].id];
      body = [
        roles.length ? fld("Who plays each role", h("div", { class:"grid", style:"gap:6px" }, roles.map(r => h("div", { class:"split" }, h("span", { style:"width:180px;font-size:13px" }, r),
          sel([["", "Leave unassigned"]].concat((r === "Customer" ? acc : team).map(u => [u.id, u.name + (r !== "Customer" ? " · " + u.role : "")])), w.roleMap[r], v => { w.roleMap[r] = v; redraw(); })))),
          "Template tasks were saved against roles, not people. Map each role to someone here.") : null,
        fld("Our team", h("div", null, team.map(u => h("label", { class:"chk-l", style:"display:flex;padding:3px 0" },
          h("input", { type:"checkbox", checked:w.team_ids.indexOf(u.id) > -1, onchange:e => { w.team_ids = e.target.checked ? uniq(w.team_ids.concat(u.id)) : w.team_ids.filter(x => x !== u.id); } }), u.name, h("span", { class:"faint" }, " · " + u.role))))),
        fld("Customer contacts", h("div", null, acc.length ? acc.map(u => h("label", { class:"chk-l", style:"display:flex;padding:3px 0" },
          h("input", { type:"checkbox", checked:w.customer_ids.indexOf(u.id) > -1, onchange:e => { w.customer_ids = e.target.checked ? uniq(w.customer_ids.concat(u.id)) : w.customer_ids.filter(x => x !== u.id); } }), u.name, h("span", { class:"faint" }, " · " + u.role)))
          : h("p", { class:"faint", style:"font-size:12.5px" }, w.account_id ? "No contacts at this account yet — invite them from the project once it exists." : "You can invite contacts once the project exists.")),
          "Contacts get the customer portal. They never see anything marked private.")];
    }
    const create = () => {
      let aid = w.account_id;
      if(!aid) aid = insert("accounts", { name:w.newAccount.trim(), domain:"", industry:"", logo_color:hashColor(w.newAccount), kind:"customer" }).id;
      const mapped = Object.values(w.roleMap).filter(Boolean);
      const p = insert("projects", { name:w.name.trim(), account_id:aid, owner_id:w.owner_id, status:w.status, start:w.start, due:w.start, start_actual:"", due_actual:"",
        team_ids:uniq(w.team_ids.concat(w.owner_id, mapped.filter(id => !isCustomer(byId("users", id))))), customer_ids:uniq(w.customer_ids.concat(mapped.filter(id => isCustomer(byId("users", id))))),
        visibility:w.visibility, portal_tabs:{ overview:true, plan:true, chat:true, files:true, updates:true }, portal_welcome:"Welcome — this is your workspace for " + w.name.trim() + ".",
        fields:{ fee:0, arr:0, budget_hours:0, billing:"Fixed fee" }, template_id:(w.tpls[0] || {}).id || "", archived:false });
      let n = 0;
      w.tpls.forEach(x => n += instantiateTemplate(byId("templates", x.id), p.id, addDays(w.start, x.offset), w.roleMap));
      if(!w.tpls.length) insert("phases", { project_id:p.id, name:"Phase 1", order:0, private:false, status:"To do", start:w.start, due:w.start });
      logAct(p.id, "", "created the project" + (w.tpls.length ? " from " + w.tpls.map(x => byId("templates", x.id).name).join(" + ") : ""));
      closeModal(); commit(); go("projects/" + p.id + "/plan"); toast("Project created" + (n ? " with " + plural(n, "task") : ""));
    };
    return [modalHead("New project", ["Basic info", "Templates", "Team & customer"][w.step - 1] + " · step " + w.step + " of 3"), steps, h("div", { class:"modal-b" }, body),
      h("div", { class:"modal-f" }, w.step > 1 ? h("button", { class:"btn", onclick:() => { w.step--; redraw(); } }, "Back") : null, h("span", { class:"grow" }),
        h("button", { class:"btn", onclick:closeModal }, "Cancel"),
        w.step < 3 ? h("button", { class:"btn primary", onclick:() => {
            if(w.step === 1 && !(w.name.trim() && (w.account_id || w.newAccount.trim()) && w.start)){ toast("Add a customer, a project name and a start date"); return; }
            w.step++; redraw(); } }, "Next")
          : h("button", { class:"btn primary", onclick:create }, "Create project"))];
  }, "wide");
}

/* ---------------- all tasks ---------------- */
let taskFilter = { who:"mine", state:"open", project:"" };
function viewTasks(){
  crumbs = [["All tasks"]];
  const u = me(), T = todayISO(), we = addDays(weekStart(T), 6);
  const ts = rows("tasks", t => !t.parent_id && liveProject(t)
    && (taskFilter.who !== "mine" || (t.assignee_ids || []).indexOf(u.id) > -1)
    && (taskFilter.state === "all" || (taskFilter.state === "open" ? t.status !== "Completed" : t.status === "Completed"))
    && (!taskFilter.project || t.project_id === taskFilter.project)).sort(by(t => t.due || "9999"));
  const groups = [["Overdue", t => isOverdue(t)], ["Today", t => t.due === T && t.status !== "Completed"], ["This week", t => t.due > T && t.due <= we],
    ["Later", t => t.due > we], ["Done", t => t.status === "Completed" && t.due <= we], ["No date", t => !t.due]];
  const seen = {};
  const tf = v => { Object.assign(taskFilter, v); scheduleRender(); };
  return h("div", { class:"page" },
    pageHead("Across every project", "All tasks", null, h("button", { class:"btn primary", onclick:() => quickTaskModal({}) }, icon("plus", "sm"), "New task")),
    h("div", { class:"filters" },
      segm([["mine","Assigned to me"],["all","Everyone"]], taskFilter.who, v => tf({ who:v })),
      segm([["open","Open"],["done","Completed"],["all","All"]], taskFilter.state, v => tf({ state:v })),
      sel([["", "All projects"]].concat(rows("projects", p => !p.archived).map(p => [p.id, p.name])), taskFilter.project, v => tf({ project:v })),
      h("span", { class:"faint", style:"font-size:12.5px" }, plural(ts.length, "task"))),
    ts.length ? groups.map(g => { const list = ts.filter(t => !seen[t.id] && g[1](t)); list.forEach(t => seen[t.id] = 1);
      return list.length ? h("div", { class:"card", style:"margin-bottom:14px" }, h("div", { class:"card-h" }, h("h3", { class:g[0] === "Overdue" ? "red" : "" }, g[0]), h("span", { class:"meta" }, list.length)),
        h("div", { class:"card-b", style:"padding:4px 14px" }, h("ul", { class:"tl" }, list.map(t => taskLine(t))))) : null; }) : h("div", { class:"card" }, empty("No tasks match.")));
}

/* ---------------- templates ---------------- */
function viewTemplates(r){
  if(r.parts[1]) return viewTemplate(byId("templates", r.parts[1]));
  crumbs = [["Templates"]];
  const tps = rows("templates").sort(by(t => t.name));
  return h("div", { class:"page" },
    pageHead("Reuse", "Templates", "A template is a project with the dates turned into day offsets and the people turned into roles. Save any project as one from its Settings tab.",
      h("button", { class:"btn primary", onclick:() => { const t = insert("templates", { name:"Untitled template", category:"Project", description:"", phases:[{ key:uid("k"), name:"Phase 1", private:false, tasks:[] }], deps:[] }); commit(); go("templates/" + t.id); } }, icon("plus", "sm"), "New template")),
    h("div", { class:"grid g3" }, tps.map(t => { const n = t.phases.reduce((s, ph) => s + ph.tasks.length, 0), ms = t.phases.reduce((s, ph) => s + ph.tasks.filter(x => x.type === "MILESTONE").length, 0);
      return h("div", { class:"card pad", style:"display:flex;flex-direction:column;gap:10px" },
        h("div", { class:"split" }, h("span", { class:"fileic doc" }, icon("layers", "sm")), h("div", { class:"grow" }, h("div", { style:"font-weight:600" }, t.name), h("div", { class:"eyebrow", style:"margin-top:2px" }, t.category + " template"))),
        h("p", { class:"sub", style:"font-size:12.5px;flex:1" }, t.description || "No description."),
        h("div", { class:"acts", style:"gap:5px" }, h("span", { class:"chip" }, plural(t.phases.length, "phase")), h("span", { class:"chip" }, plural(n, "task")), h("span", { class:"chip" }, plural(ms, "milestone")),
          h("span", { class:"chip" }, Math.ceil((templateSpan(t) + 1) / 7) + " wk")),
        h("div", { class:"faint", style:"font-size:12px" }, "Roles: " + (templateRoles(t).join(", ") || "none")),
        h("div", { class:"acts" }, h("button", { class:"btn primary sm", onclick:() => wizard({ template_id:t.id }) }, "Use template"), h("a", { class:"btn sm", href:"#/templates/" + t.id }, "Edit")));
    })));
}
function editTpl(t, fn){ const c = JSON.parse(JSON.stringify({ phases:t.phases, deps:t.deps || [] })); fn(c); update("templates", t.id, c); commit(); }
function viewTemplate(t){
  if(!t) return h("div", { class:"page" }, empty("That template doesn't exist."));
  crumbs = [["Templates", "#/templates"], [t.name]];
  const roles = uniq(rows("users", u => u.type === "TEAM").map(u => u.role).concat(["Customer"], templateRoles(t)));
  const allTasks = t.phases.flatMap(ph => ph.tasks);
  const num = (v, on) => h("input", { class:"inp bare", type:"number", style:"width:64px;text-align:right;font-family:var(--mono);font-size:12px", value:v, onchange:e => on(Math.max(0, +e.target.value || 0)) });
  return h("div", { class:"page" },
    h("div", { class:"phead" }, h("div", { class:"grow" }, h("div", { class:"eyebrow" }, "Project template"),
      h("input", { class:"inp bare", style:"font-family:var(--display);font-size:28px;padding:2px 6px;margin-left:-6px;width:100%", value:t.name, onchange:e => { update("templates", t.id, { name:e.target.value.trim() || t.name }); commit(); } }),
      h("input", { class:"inp bare", style:"font-size:13.5px;color:var(--muted);width:100%;margin-left:-6px", placeholder:"What this template is for", value:t.description || "", onchange:e => { update("templates", t.id, { description:e.target.value }); commit(); } })),
      h("div", { class:"acts" }, h("span", { class:"chip" }, "Runs " + plural(templateSpan(t) + 1, "day")),
        h("button", { class:"btn danger", onclick:() => confirmBox("Delete this template?", "Projects already created from it are not affected.", "Delete", () => { remove("templates", t.id); commit(); go("templates"); }, true) }, icon("trash", "sm")),
        h("button", { class:"btn primary", onclick:() => wizard({ template_id:t.id }) }, "Create project from this"))),
    h("p", { class:"sub", style:"margin-bottom:16px" }, "Day 0 is the project start. A task that waits on another starts the day after it ends when the template is used."),
    t.phases.map((ph, pi) => h("div", { class:"card", style:"margin-bottom:14px" + (ph.private ? ";background:var(--gold-soft)" : "") },
      h("div", { class:"card-h" },
        h("input", { class:"inp bare", style:"font-weight:600;font-size:14px;flex:1", value:ph.name, onchange:e => editTpl(t, c => c.phases[pi].name = e.target.value) }),
        h("label", { class:"chk-l" }, h("input", { type:"checkbox", checked:!!ph.private, onchange:e => editTpl(t, c => c.phases[pi].private = e.target.checked) }), icon("lock", "xs"), "Private phase"),
        h("button", { class:"iconbtn", title:"Delete phase", onclick:() => editTpl(t, c => { const keys = c.phases[pi].tasks.map(x => x.key); c.phases.splice(pi, 1); c.deps = c.deps.filter(d => keys.indexOf(d[0]) === -1 && keys.indexOf(d[1]) === -1); }) }, icon("trash", "sm"))),
      h("div", { class:"tbl-wrap" }, h("table", { class:"tbl" },
        h("thead", null, h("tr", null, h("th", null, "Task"), h("th", null, "Type"), h("th", { class:"num" }, "Start day"), h("th", { class:"num" }, "Days"), h("th", { class:"num" }, "Effort h"), h("th", null, "Role"), h("th", null, "Waits on"), h("th", null, "Private"), h("th"))),
        h("tbody", null, ph.tasks.map((tk, ti) => {
          const deps = (t.deps || []).filter(d => d[0] === tk.key);
          return h("tr", null,
            h("td", null, h("input", { class:"inp bare", style:"width:100%;min-width:200px", value:tk.name, onchange:e => editTpl(t, c => c.phases[pi].tasks[ti].name = e.target.value) })),
            h("td", null, sel([["TASK","Task"],["MILESTONE","Milestone"]], tk.type || "TASK", v => editTpl(t, c => { c.phases[pi].tasks[ti].type = v; if(v === "MILESTONE") c.phases[pi].tasks[ti].duration = 0; }), "bare")),
            h("td", { class:"num" }, num(tk.start_offset || 0, v => editTpl(t, c => c.phases[pi].tasks[ti].start_offset = v))),
            h("td", { class:"num" }, tk.type === "MILESTONE" ? "—" : num((tk.duration || 0) + 1, v => editTpl(t, c => c.phases[pi].tasks[ti].duration = Math.max(0, v - 1)))),
            h("td", { class:"num" }, num(tk.effort_h || 0, v => editTpl(t, c => c.phases[pi].tasks[ti].effort_h = v))),
            h("td", null, sel([["", "—"]].concat(roles.map(r => [r, r])), tk.role || "", v => editTpl(t, c => c.phases[pi].tasks[ti].role = v), "bare")),
            h("td", null, deps.map(d => { const b = allTasks.find(x => x.key === d[1]); return b ? h("span", { class:"chip", style:"margin:2px" }, b.name.slice(0, 22),
                h("button", { onclick:() => editTpl(t, c => c.deps = c.deps.filter(x => !(x[0] === d[0] && x[1] === d[1]))) }, "×")) : null; }),
              sel([["", "+"]].concat(allTasks.filter(x => x.key !== tk.key && !deps.some(d => d[1] === x.key)).map(x => [x.key, x.name])), "", v => v && editTpl(t, c => c.deps.push([tk.key, v])), "bare")),
            h("td", null, h("input", { type:"checkbox", checked:!!tk.private, onchange:e => editTpl(t, c => c.phases[pi].tasks[ti].private = e.target.checked) })),
            h("td", null, h("button", { class:"iconbtn", style:"width:28px;height:28px", onclick:() => editTpl(t, c => { c.phases[pi].tasks.splice(ti, 1); c.deps = c.deps.filter(d => d[0] !== tk.key && d[1] !== tk.key); }) }, icon("x", "sm"))));
        }),
        h("tr", null, h("td", { colspan:9 }, h("input", { class:"inp", placeholder:"+ Add a task and press Enter", onkeydown:e => {
          if(e.key !== "Enter" || !e.target.value.trim()) return;
          const last = ph.tasks.slice(-1)[0], v = e.target.value.trim(); e.target.value = "";
          editTpl(t, c => c.phases[pi].tasks.push({ key:uid("k"), name:v, type:"TASK", start_offset:last ? (last.start_offset || 0) + (last.duration || 0) + 1 : 0, duration:0, effort_h:0, role:"", private:false }));
        } }))))))) ),
    h("button", { class:"btn", onclick:() => editTpl(t, c => c.phases.push({ key:uid("k"), name:"New phase", private:false, tasks:[] })) }, icon("plus", "sm"), "Add phase"));
}

/* ---------------- timesheets ---------------- */
let tsExtra = [];   // rows added this session that have no hours yet
function viewTimesheets(r){
  const u = me(), ws = r.q.w || weekStart(todayISO()), we = addDays(ws, 6), T = todayISO();
  const mode = r.parts[1] === "approve" ? "approve" : "mine";
  crumbs = [["Time", "#/timesheets"], [mode === "approve" ? "Approve" : "My timesheet"]];
  const nav = h("div", { class:"split", style:"gap:6px" },
    h("button", { class:"iconbtn", onclick:() => go("timesheets" + (mode === "approve" ? "/approve" : ""), { w:addDays(ws, -7) }) }, icon("left")),
    h("b", { style:"font-size:14px;min-width:150px;text-align:center" }, fmtD(ws) + " – " + fmtD(we)),
    h("button", { class:"iconbtn", onclick:() => go("timesheets" + (mode === "approve" ? "/approve" : ""), { w:addDays(ws, 7) }) }, icon("right")),
    ws !== weekStart(T) ? h("button", { class:"btn sm", onclick:() => go("timesheets" + (mode === "approve" ? "/approve" : "")) }, "This week") : null);
  const head = pageHead("Time tracking", mode === "approve" ? "Approve timesheets" : "My timesheet", null,
    segm([["mine","My timesheet"],["approve","Approve"]], mode, v => go(v === "approve" ? "timesheets/approve" : "timesheets", { w:ws })));
  if(mode === "approve") return h("div", { class:"page" }, head, h("div", { class:"filters" }, nav), approveView(ws, we));

  const es = myEntries(u.id, ws, we);
  const keyOf = e => e.project_id + "|" + e.task_id;
  const keys = uniq(es.map(keyOf).concat(tsExtra.filter(k => k.w === ws).map(k => k.key)));
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
  const statuses = uniq(es.map(e => e.status));
  const wkStatus = !es.length ? "Empty" : statuses.indexOf("REJECTED") > -1 ? "Rejected" : statuses.every(s => s === "APPROVED") ? "Approved"
    : statuses.indexOf("NOT_SUBMITTED") > -1 ? "Not submitted" : "Submitted";
  const total = es.reduce((s, e) => s + e.minutes, 0);
  const cell = (key, d) => {
    const [pid, tid] = key.split("|");
    const e = es.find(x => x.task_id === tid && x.date === d);
    const locked = e && (e.status === "SUBMITTED" || e.status === "APPROVED");
    return h("td", { class:"cell" + (d === T ? " today" : "") }, h("input", { class:"h", value:e && e.minutes ? fmtMins(e.minutes) : "", disabled:locked, placeholder:"",
      title:locked ? "Submitted — withdraw the week to edit" : "Hours, e.g. 1:30 or 1.5",
      onchange:ev => { const m = parseHours(ev.target.value);
        if(e){ if(m) update("time_entries", e.id, { minutes:m, status:e.status === "REJECTED" ? "NOT_SUBMITTED" : e.status }); else remove("time_entries", e.id); }
        else if(m) insert("time_entries", { user_id:u.id, date:d, minutes:m, project_id:pid, task_id:tid, billable:true, notes:"", status:"NOT_SUBMITTED" });
        commit(); } }));
  };
  return h("div", { class:"page" }, head,
    h("div", { class:"filters" }, nav, h("span", { style:"flex:1" }),
      pill(wkStatus, { "Approved":"done", "Submitted":"prog", "Rejected":"blocked", "Not submitted":"risk" }[wkStatus] || "", true),
      h("span", { class:"mono", style:"font-size:12.5px" }, fmtMins(total) + " / " + fmtMins(u.capacity_min || 2400) + " h"),
      h("button", { class:"btn", onclick:() => tsRowModal(ws) }, icon("plus", "sm"), "Add row"),
      statuses.indexOf("SUBMITTED") > -1 ? h("button", { class:"btn", onclick:() => { es.filter(e => e.status === "SUBMITTED").forEach(e => update("time_entries", e.id, { status:"NOT_SUBMITTED" })); commit(); toast("Withdrawn — you can edit again"); } }, "Withdraw") : null,
      es.some(e => e.status === "NOT_SUBMITTED" || e.status === "REJECTED") ? h("button", { class:"btn primary", onclick:() => {
        const sub = es.filter(e => e.status === "NOT_SUBMITTED" || e.status === "REJECTED");
        sub.forEach(e => update("time_entries", e.id, { status:"SUBMITTED", submitted_at:nowISO() }));
        uniq(sub.map(e => (byId("projects", e.project_id) || {}).owner_id)).forEach(o => notify(o, u.name + " submitted a timesheet for " + fmtD(ws) + " – " + fmtD(we), "#/timesheets/approve?w=" + ws));
        commit(); toast("Submitted " + fmtMins(sub.reduce((s, e) => s + e.minutes, 0)) + " h for approval"); } }, "Submit week") : null),
    h("div", { class:"card" }, h("div", { class:"tbl-wrap" }, h("table", { class:"tbl ts" },
      h("thead", null, h("tr", null, h("th", null, "Project / task"), days.map(d => h("th", { class:"num" + (d === T ? " today" : "") }, DOW[parseISO(d).getDay()] + " " + parseISO(d).getDate())), h("th", { class:"num" }, "Total"))),
      h("tbody", null, keys.length ? keys.map(k => { const [pid, tid] = k.split("|"), t = byId("tasks", tid), p = byId("projects", pid);
        const rt = es.filter(e => keyOf(e) === k).reduce((s, e) => s + e.minutes, 0);
        return h("tr", null, h("td", null, h("div", { style:"font-weight:500" }, t ? t.name : "(deleted task)"), h("div", { class:"faint", style:"font-size:11.5px" }, p ? p.name : "")),
          days.map(d => cell(k, d)), h("td", { class:"num" }, fmtMins(rt))); })
        : h("tr", null, h("td", { colspan:9 }, empty("No time this week. Add a row, or log time from a task or My Day.")))),
      keys.length ? h("tfoot", null, h("tr", null, h("td", null, "Total"), days.map(d => h("td", { class:"num" + (d === T ? " today" : "") }, fmtMins(es.filter(e => e.date === d).reduce((s, e) => s + e.minutes, 0)))),
        h("td", { class:"num" }, fmtMins(total)))) : null))));
}
function tsRowModal(ws){
  const u = me();
  openModal(redraw => {
    const ps = rows("projects", p => !p.archived && ((p.team_ids || []).indexOf(u.id) > -1 || p.owner_id === u.id));
    if(!tsRowModal.pid || !ps.find(p => p.id === tsRowModal.pid)) tsRowModal.pid = (ps[0] || {}).id;
    const ts = projTasks(tsRowModal.pid || "").sort(by(t => ((t.assignee_ids || []).indexOf(u.id) > -1 ? "0" : "1") + (t.due || "")));
    let tid = (ts[0] || {}).id;
    return [modalHead("Add a row"), h("div", { class:"modal-b" },
      h("div", { class:"fld" }, h("label", null, "Project"), sel(ps.map(p => [p.id, p.name]), tsRowModal.pid, v => { tsRowModal.pid = v; redraw(); })),
      h("div", { class:"fld" }, h("label", null, "Task"), sel(ts.map(t => [t.id, t.name + ((t.assignee_ids || []).indexOf(u.id) > -1 ? " · yours" : "")]), tid, v => tid = v))),
      h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => {
        if(!tid) return; tsExtra.push({ w:ws, key:tsRowModal.pid + "|" + tid }); closeModal(); render(); } }, "Add"))];
  }, "narrow");
}
function approveView(ws, we){
  const u = me();
  const es = rows("time_entries", e => e.date >= ws && e.date <= we && (e.status === "SUBMITTED" || e.status === "APPROVED" || e.status === "REJECTED")
    && (byId("projects", e.project_id) || {}).owner_id === u.id);
  const groups = {}; es.forEach(e => { const k = e.user_id + "|" + e.project_id; (groups[k] = groups[k] || []).push(e); });
  const act = (list, status) => { list.forEach(e => update("time_entries", e.id, { status, reviewed_by:u.id, reviewed_at:nowISO() }));
    uniq(list.map(e => e.user_id)).forEach(x => notify(x, u.name + (status === "APPROVED" ? " approved" : " rejected") + " your time for " + fmtD(ws) + " – " + fmtD(we), "#/timesheets?w=" + ws));
    commit(); toast(status === "APPROVED" ? "Approved" : "Rejected — sent back to edit"); };
  const pend = es.filter(e => e.status === "SUBMITTED");
  return h("div", { class:"card" },
    h("div", { class:"card-h" }, h("h3", null, "Time on projects you own"), h("span", { class:"meta" }, plural(pend.length, "entry", "entries") + " waiting"),
      pend.length ? h("button", { class:"btn jade sm", onclick:() => act(pend, "APPROVED") }, "Approve all") : null),
    Object.keys(groups).length ? h("table", { class:"tbl" }, h("thead", null, h("tr", null, h("th", null, "Person"), h("th", null, "Project"), h("th", { class:"num" }, "Hours"), h("th", null, "Status"), h("th"))),
      h("tbody", null, Object.keys(groups).map(k => { const list = groups[k], [uid_, pid] = k.split("|"), sub = list.filter(e => e.status === "SUBMITTED");
        const st = sub.length ? "Submitted" : list.every(e => e.status === "APPROVED") ? "Approved" : "Rejected";
        return h("tr", null, h("td", null, whoRow(uid_)), h("td", null, (byId("projects", pid) || {}).name),
          h("td", { class:"num" }, fmtMins(list.reduce((s, e) => s + e.minutes, 0))), h("td", null, pill(st, { Approved:"done", Submitted:"prog", Rejected:"blocked" }[st], true)),
          h("td", { style:"text-align:right" }, sub.length ? h("div", { class:"acts", style:"justify-content:flex-end" },
            h("button", { class:"btn sm", onclick:() => act(sub, "REJECTED") }, "Reject"), h("button", { class:"btn jade sm", onclick:() => act(sub, "APPROVED") }, "Approve")) : null)); })))
      : empty("Nothing submitted for this week on projects you own."));
}

/* ---------------- settings ---------------- */
function viewSettings(){
  crumbs = [["Settings"]];
  const url = h("input", { class:"inp mono", style:"font-size:12px", placeholder:"https://script.google.com/macros/s/…/exec", value:cfg.url });
  const tok = h("input", { class:"inp mono", style:"font-size:12px", placeholder:"same string as SECRET in Code.gs", value:cfg.token });
  const dirty = read(LS_DIRTY, []).length;
  const counts = COLLS.map(c => [c, rows(c).length]);
  return h("div", { class:"page" },
    pageHead("Workspace", "Settings", null),
    h("div", { class:"grid g2" },
      card("Google Sheets sync", syncConfigured() ? syncState.text : "Off", [
        h("p", { class:"sub", style:"margin-bottom:12px" }, "Everything saves to this browser first. Once an Apps Script web app is deployed (Phase 2), paste its URL here and every change is pushed to a Google Sheet — one tab per record type — and pulled back on other devices."),
        h("div", { class:"fld" }, h("label", null, "Apps Script web app URL"), url, h("div", { class:"hint" }, "Ends in /exec. Deploy → New deployment → Web app, execute as Me, access Anyone.")),
        h("div", { class:"fld" }, h("label", null, "Shared secret"), tok),
        h("div", { class:"acts" }, h("button", { class:"btn primary", onclick:() => { cfg.url = url.value.trim(); cfg.token = tok.value.trim(); saveCfg(); if(syncConfigured()){ sync(); toast("Saved — syncing"); } else toast("Sync turned off"); render(); } }, "Save"),
          syncConfigured() ? h("button", { class:"btn", onclick:() => { sync(); pull(); toast("Syncing…"); } }, "Sync now") : null,
          h("span", { class:"faint", style:"font-size:12px" }, plural(dirty, "change") + " waiting to sync"))]),
      card("Data in this browser", null, [
        h("table", { class:"tbl", style:"margin-bottom:12px" }, h("tbody", null, counts.map(c => h("tr", null, h("td", { class:"mono", style:"font-size:12px" }, c[0]), h("td", { class:"num" }, c[1]))))),
        h("div", { class:"acts" },
          h("button", { class:"btn", onclick:exportJson }, icon("upload", "sm"), "Export JSON"),
          h("label", { class:"btn" }, "Import JSON", h("input", { type:"file", accept:".json,application/json", hidden:true, onchange:e => importJson(e.target.files[0]) })),
          h("button", { class:"btn danger", onclick:() => confirmBox("Reset to the demo data?", "Replaces every project, task and message in this browser with the Stonebridge demo. My Day is not touched.", "Reset",
            () => { seedDb(); write(LS_DIRTY, []); commit(); go("home"); toast("Demo data restored"); }, true) }, "Reset demo data"))]),
      card("My Day", null, [h("p", { class:"sub" }, "My Day is the Day app, running inside Lane. Its mood, routine, journal and personal tasks stay in its own storage and keep its own Google Sheet sync — set that up from My Day → Settings. Project tasks assigned to you and approvals waiting on you show up in its Today and Home screens.")]),
      card("Team", plural(rows("users", u => u.type === "TEAM").length, "person", "people"), [
        rows("users", u => u.type === "TEAM").map(u => h("div", { style:"margin-bottom:9px" }, whoRow(u, u.role + " · " + (u.email || "")))),
        h("button", { class:"btn sm", onclick:() => { openModal(() => {
          const n = h("input", { class:"inp", placeholder:"Full name" }), r = h("input", { class:"inp", placeholder:"e.g. Implementation Engineer" }), e = h("input", { class:"inp", placeholder:"email" });
          return [modalHead("Add a teammate"), h("div", { class:"modal-b" }, h("div", { class:"fld" }, h("label", null, "Name"), n), h("div", { class:"row" }, h("div", { class:"fld" }, h("label", null, "Role"), r), h("div", { class:"fld" }, h("label", null, "Email"), e))),
            h("div", { class:"modal-f" }, h("button", { class:"btn", onclick:closeModal }, "Cancel"), h("button", { class:"btn primary", onclick:() => { if(!n.value.trim()) return;
              insert("users", { name:n.value.trim(), type:"TEAM", role:r.value.trim() || "Team member", account_id:"ac-us", email:e.value.trim(), capacity_min:2400, status:"ACTIVE" }); closeModal(); commit(); } }, "Add"))]; }, "narrow"); } },
          icon("plus", "sm"), "Add teammate")])));
}
function exportJson(){
  const blob = new Blob([JSON.stringify(db, null, 1)], { type:"application/json" });
  const a = h("a", { href:URL.createObjectURL(blob), download:"lane-export-" + todayISO() + ".json" }); document.body.appendChild(a); a.click(); a.remove();
}
function importJson(file){
  if(!file) return;
  const fr = new FileReader();
  fr.onload = () => { try{ const d = JSON.parse(fr.result); if(!d || !Array.isArray(d.projects)) throw new Error("not a Lane export");
    COLLS.forEach(c => d[c] = d[c] || []); db = d; saveDb(); COLLS.forEach(c => db[c].forEach(r => markDirty(c, r.id))); commit(); toast("Imported"); }
    catch(e){ toast("Couldn't import: " + e.message); } };
  fr.readAsText(file);
}

const VIEWS = { home:viewHome, accounts:viewAccounts, projects:viewProjects, tasks:viewTasks, templates:viewTemplates, timesheets:viewTimesheets, settings:viewSettings };
