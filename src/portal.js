/* =====================================================================
   Customer portal — a separate shell, not a filtered copy of the app.
   Everything here goes through visibleTo(), so a private phase, task,
   message or file can never reach it.
   ===================================================================== */

function portalViewer(){
  const r = parseRoute(), p = byId("projects", r.parts[1]); if(!p) return null;
  let id = session.portalAs[p.id];
  if(!id || (p.customer_ids || []).indexOf(id) === -1) id = (p.customer_ids || [])[0];
  return byId("users", id);
}
function renderPortal(r){
  const root = $("ln-portal"), p = byId("projects", r.parts[1]), v = portalViewer();
  const keep = lastPath === r.path ? root.scrollTop : 0;
  root.innerHTML = "";
  if(!p || !v){
    add(root, h("div", { class:"pt-page" }, h("div", { class:"card pad" }, h("h2", { class:"h2" }, p ? "No customer contacts yet" : "Project not found"),
      h("p", { class:"sub", style:"margin:8px 0 14px" }, p ? "Invite a customer contact to the project first — the portal is what they see." : ""),
      h("a", { class:"btn", href:p ? "#/projects/" + p.id + "/overview" : "#/projects" }, icon("left", "sm"), "Back to the project"))));
    lastPath = r.path; return;
  }
  const tabsOn = p.portal_tabs || {}, tab = r.parts[2] || "home";
  const vendor = rows("accounts", a => a.kind === "vendor")[0] || { name:"Your team" }, acct = byId("accounts", p.account_id) || {};
  const actions = rows("approvals", a => a.status === "REQUESTED" && (a.approver_ids || []).indexOf(v.id) > -1 && visibleTo(v, "approvals", a));
  const myOpen = rows("tasks", t => t.project_id === p.id && (t.assignee_ids || []).indexOf(v.id) > -1 && t.status !== "Completed" && visibleTo(v, "tasks", t));
  const nav = [["home", "Home", "home", tabsOn.overview !== false], ["plan", "Plan", "board", true], ["files", "Files", "file", tabsOn.files !== false],
    ["updates", "Updates", "megaphone", tabsOn.updates !== false], ["chat", "Chat", "chat", tabsOn.chat !== false], ["actions", "Action items", "inbox", true]].filter(x => x[3]);
  const myProjects = rows("projects", x => (x.customer_ids || []).indexOf(v.id) > -1 && !x.archived);
  const L = t => "#/portal/" + p.id + "/" + t;
  const body = ({ home:ptHome, plan:ptPlan, files:(p, v) => tabFiles(p, r, v), updates:ptUpdates, chat:(p, v) => convo(p, "general", { viewer:v, full:true }), actions:ptActions }[tab] || ptHome)(p, v, actions, myOpen);
  add(root, [
    h("div", { class:"pt-top" },
      h("div", { class:"pt-banner" }, icon("eye", "sm"), h("span", { class:"grow" }, "Preview — this is exactly what ", h("b", null, v.name), " sees. Nothing private is shown."),
        (p.customer_ids || []).length > 1 ? sel((p.customer_ids || []).map(id => [id, userName(id)]), v.id, x => { session.portalAs[p.id] = x; saveSession(); render(); }) : null,
        h("button", { onclick:() => go("projects/" + p.id + "/overview") }, "Exit preview")),
      h("div", { class:"pt-bar" },
        h("div", { class:"pt-logos" }, acctLogo(vendor), h("span", { class:"x" }, "×"), acctLogo(acct), h("b", { style:"font-size:13.5px;margin-left:4px" }, acct.name)),
        h("nav", { class:"pt-nav" }, nav.map(n => h("a", { href:L(n[0]), "aria-current":tab === n[0] ? "page" : null }, icon(n[2], "sm"), n[1],
          n[0] === "actions" && actions.length + myOpen.length ? h("span", { class:"cnt" }, actions.length + myOpen.length) : null))),
        myProjects.length > 1 ? sel(myProjects.map(x => [x.id, x.name]), p.id, x => go("portal/" + x + "/" + tab)) : null,
        avatar(v, "lg"))),
    h("div", { class:"pt-page" }, body)]);
  root.scrollTop = keep;
  lastPath = r.path;
}

function ptHome(p, v, actions, myOpen){
  const hl = health(p.id), vis = t => visibleTo(v, "tasks", t), T = todayISO();
  const tasks = hl.tasks.filter(vis), done = tasks.filter(t => t.status === "Completed").length, pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const next = hl.milestones.filter(vis).find(m => m.status !== "Completed");
  const team = (p.team_ids || []).map(id => byId("users", id)).filter(Boolean);
  const coming = tasks.filter(t => t.status !== "Completed" && t.due >= T).sort(by(t => t.due)).slice(0, 6);
  const up = rows("updates", u => u.project_id === p.id && !u.private).sort(by(u => u.at)).reverse()[0];
  return [
    h("div", { class:"pt-hero" },
      h("div", { class:"grow" }, h("div", { class:"eyebrow" }, "Your project"), h("h1", null, p.name), h("p", { class:"sub", style:"font-size:14.5px;max-width:620px" }, p.portal_welcome || "")),
      h("div", { style:"text-align:center;min-width:150px" }, h("div", { style:"font-family:var(--display);font-size:48px;line-height:1" }, pct + "%"),
        h("div", { class:"eyebrow", style:"margin:6px 0 10px" }, done + " of " + tasks.length + " done"), bar(pct))),
    h("div", { class:"keyband" },
      h("div", null, h("div", { class:"eyebrow" }, "Status"), h("div", { class:"v" }, p.status)),
      h("div", null, h("div", { class:"eyebrow" }, "Started"), h("div", { class:"v" }, fmtDY(p.start))),
      h("div", null, h("div", { class:"eyebrow" }, "Target go-live"), h("div", { class:"v" }, fmtDY(p.due))),
      h("div", null, h("div", { class:"eyebrow" }, "Next milestone"), h("div", { class:"v" }, next ? next.name + " · " + fmtD(next.due) : "—")),
      h("div", null, h("div", { class:"eyebrow" }, "Waiting on you"), h("div", { class:"v", style:actions.length + myOpen.length ? "color:var(--red)" : "" }, plural(actions.length + myOpen.length, "item")))),
    h("div", { class:"grid g-main" },
      h("div", { class:"grid", style:"align-content:start" },
        actions.length || myOpen.length ? card("Waiting on you", null, [actions.map(a => approvalCard(a, v)), h("ul", { class:"tl" }, myOpen.map(t => taskLine(t)))], { icon:"inbox" }) : null,
        card("Coming up", null, coming.length ? h("ul", { class:"tl" }, coming.map(t => taskLine(t))) : empty("Nothing scheduled.")),
        up ? card("Latest update", fmtAgo(up.at), updateItem(up)) : null),
      h("div", { class:"grid", style:"align-content:start" },
        card("Your project team", null, team.map(u => h("div", { style:"margin-bottom:10px" }, whoRow(u, u.role + (u.id === p.owner_id ? " · your project lead" : ""))))),
        card("Milestones", null, h("ul", { class:"tl" }, hl.milestones.filter(vis).map(m => h("li", null, h("span", { style:"color:" + (m.status === "Completed" ? "var(--jade)" : "var(--violet)") }, icon("diamond", "sm")),
          h("div", { class:"grow" }, h("div", { class:"nm" }, m.name)), h("span", { class:"when" }, m.status === "Completed" ? "Done" : fmtD(m.due)))))))) ];
}
let ptPlanMine = false;
function ptPlan(p, v){
  const phs = projPhases(p.id).filter(ph => !ph.private);
  return [h("div", { class:"filters" }, h("h2", { class:"h2", style:"flex:1" }, "Project plan"),
      segm([["all","Everything"],["mine","Assigned to me"]], ptPlanMine ? "mine" : "all", x => { ptPlanMine = x === "mine"; render(); })),
    phs.map(ph => {
      const all = phaseTasks(ph.id).filter(t => visibleTo(v, "tasks", t)), ts = all.filter(t => !ptPlanMine || (t.assignee_ids || []).indexOf(v.id) > -1);
      if(!ts.length && ptPlanMine) return null;
      const dn = all.filter(t => t.status === "Completed").length;
      return h("div", { class:"card", style:"margin-bottom:14px" },
        h("div", { class:"card-h" }, dn === all.length && all.length ? h("span", { class:"col-done" }, icon("check", "xs")) : null, h("h3", null, ph.name),
          h("span", { class:"meta" }, fmtRange(ph.start, ph.due) + " · " + dn + "/" + all.length), h("div", { style:"width:120px" }, bar(all.length ? dn / all.length * 100 : 0))),
        h("div", { class:"card-b", style:"padding:2px 14px" }, h("ul", { class:"tl" }, ts.map(t => {
          const mine = (t.assignee_ids || []).indexOf(v.id) > -1, dl = dueLabel(t.due, t.status === "Completed");
          return h("li", { class:"click", onclick:() => openTask(t.id) }, statusCircle(t, mine ? undefined : false),
            h("div", { class:"grow" }, h("div", { class:"nm" }, t.name), mine ? h("div", { class:"ctx", style:"color:var(--violet)" }, "Assigned to you") : null),
            avatars(t.assignee_ids), h("span", { class:"when" + (dl.late ? " late" : "") }, t.type === "MILESTONE" ? fmtD(t.due) : fmtRange(t.start, t.due)));
        }))));
    })];
}
function ptUpdates(p){
  const ups = rows("updates", u => u.project_id === p.id && !u.private).sort(by(u => u.at)).reverse();
  return card("Project updates", plural(ups.length, "update"), ups.length ? ups.map(updateItem) : empty("No updates yet."));
}
function ptActions(p, v, actions, myOpen){
  const done = rows("approvals", a => a.status !== "REQUESTED" && a.responded_by === v.id && a.project_id === p.id);
  return h("div", { class:"grid g2" },
    card("Approvals for you", actions.length, actions.length ? actions.map(a => { const t = byId("tasks", a.task_id);
      return h("div", null, h("a", { href:"javascript:void 0", onclick:() => openTask(t.id), style:"font-weight:600;color:var(--text);display:block;margin-bottom:6px" }, t.name), approvalCard(a, v)); })
      : empty("Nothing waiting on your approval."), { icon:"flag" }),
    h("div", { class:"grid", style:"align-content:start" },
      card("Your open tasks", myOpen.length, myOpen.length ? h("ul", { class:"tl" }, myOpen.map(t => taskLine(t))) : empty("No open tasks assigned to you.")),
      done.length ? card("You've already approved", done.length, h("ul", { class:"tl" }, done.map(a => h("li", null, icon("check", "sm"), h("div", { class:"grow" }, (byId("tasks", a.task_id) || {}).name), h("span", { class:"when" }, fmtAgo(a.responded_at)))))) : null));
}
