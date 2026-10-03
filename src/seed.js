/* =====================================================================
   Seed — a sample roofing implementation (Stonebridge Roofing Group):
   7 overlapping phases, 55 tasks, 6 milestones. Dates are
   anchored to 1 Oct 2026 and shifted to today, so the demo always opens
   partway through the project, the way a real one looks on a Tuesday.
   ===================================================================== */
function seedDb(){
  db = blankDb();
  const SHIFT = diffDays("2026-10-01", todayISO());
  const D = md => addDays("2026-" + md, SHIFT);
  const ago = h => new Date(Date.now() - h * 3600e3).toISOString();

  const acct = (id, name, domain, color, kind) => insert("accounts", { id, name, domain, logo_color:color, kind:kind || "customer", industry:"" });
  acct("ac-us", "Fieldproxy", "fieldproxy.com", "#221C29", "vendor");
  acct("ac-sb", "Stonebridge Roofing Group", "stonebridgeroofing.example", "#B4483F");
  acct("ac-hm", "Harbor Mechanical", "harbormech.example", "#2F7F8F");
  acct("ac-pc", "Pinecrest Landscaping", "pinecrest.example", "#5C7A2E");
  byId("accounts", "ac-sb").industry = "Roofing · 3 branches · 40 field users";
  byId("accounts", "ac-hm").industry = "HVAC service · 2 branches";
  byId("accounts", "ac-pc").industry = "Landscaping · 1 branch";

  const user = (id, name, type, role, account_id, email) => insert("users", { id, name, type, role, account_id, email, capacity_min:2400, status:"ACTIVE" });
  user("u-anand", "Anand Viswanathan", "TEAM", "Solution Architect", "ac-us", "anand@team.example");
  user("u-nandy", "Nandy Krishnan", "TEAM", "Implementation Engineer", "ac-us", "nandy@team.example");
  user("u-priya", "Priya Raman", "TEAM", "QA & Migration", "ac-us", "priya@team.example");
  user("u-afrin", "Afrin Sultana", "TEAM", "Product Designer", "ac-us", "afrin@team.example");
  user("u-mark", "Mark Ellison", "CUSTOMER", "Owner", "ac-sb", "mark@stonebridgeroofing.example");
  user("u-jess", "Jess Navarro", "CUSTOMER", "Ops Lead", "ac-sb", "jess@stonebridgeroofing.example");
  user("u-tom", "Tom Becker", "CUSTOMER", "Estimating Lead", "ac-sb", "tom@stonebridgeroofing.example");
  user("u-lena", "Lena Ortiz", "CUSTOMER", "Service Manager", "ac-hm", "lena@harbormech.example");
  user("u-raj", "Raj Patel", "CUSTOMER", "General Manager", "ac-pc", "raj@pinecrest.example");
  session.user = session.user && byId("users", session.user) ? session.user : "u-anand"; saveSession();

  /* ---------------- Stonebridge ---------------- */
  const P = "p-sb";
  insert("projects", { id:P, name:"Field-ops & estimating platform", account_id:"ac-sb", owner_id:"u-anand",
    status:"In progress", start:D("09-01"), due:D("11-28"), start_actual:D("09-01"), due_actual:"",
    team_ids:["u-anand","u-nandy","u-priya","u-afrin"], customer_ids:["u-mark","u-jess","u-tom"], visibility:"EVERYONE",
    portal_tabs:{ overview:true, plan:true, chat:true, files:true, updates:true },
    portal_welcome:"Welcome to your implementation workspace. Everything we're building together — the plan, the files, and every decision we need from you — lives here.",
    fields:{ fee:42000, arr:18000, budget_hours:235, billing:"Fixed fee" }, template_id:"", archived:false });

  const who = { A:"u-anand", N:"u-nandy", P:"u-priya", F:"u-afrin", M:"u-mark", J:"u-jess", T:"u-tom" };
  const phases = [
    ["Handoff & Discovery", [
      ["Sales handoff call", "09-01", "09-01", "Completed", "A", { eff:2 }],
      ["Stakeholder map", "09-02", "09-03", "Completed", "A", { eff:3 }],
      ["Legacy CRM audit", "09-03", "09-08", "Completed", "N", { eff:10 }],
      ["Field shadow — roof inspection #1", "09-04", "09-04", "Completed", "F", { eff:5 }],
      ["Field shadow — roof inspection #2", "09-09", "09-09", "Completed", "F", { eff:5 }],
      ["Data inventory", "09-08", "09-11", "Completed", "P", { eff:8 }],
      ["Discovery Complete", "09-12", "09-12", "Completed", "A", { ms:1 }]
    ]],
    ["Requirements & Scope Lock", [
      ["KT call 1 — estimating", "09-10", "09-10", "Completed", "A", { eff:2 }],
      ["KT call 2 — orders & suppliers", "09-15", "09-15", "Completed", "A", { eff:2 }],
      ["Measurement tokens — squares, eaves, rakes, ridge, hips, valleys, pitch", "09-11", "09-16", "Completed", "N", { eff:6 }],
      ["Estimate templates — product list per token", "09-15", "09-19", "Completed", "T", { eff:4 }],
      ["Waste and coverage rules", "09-17", "09-22", "In progress", "N", { eff:6, risk:1 }],
      ["Trade taxonomy", "09-18", "09-22", "Completed", "J", { eff:3 }],
      ["Custom vs hard-coded boundary", "09-21", "09-24", "Completed", "A", { eff:4 }],
      ["Scope document sign-off", "09-24", "09-26", "In progress", "M", { eff:1 }],
      ["Scope Locked", "09-26", "09-26", "To do", "A", { ms:1 }]
    ]],
    ["Solution Design & Prototype", [
      ["Clickable prototype", "09-22", "10-02", "In progress", "F", { eff:18 }],
      ["Estimate-builder logic", "09-24", "10-01", "In progress", "N", { eff:12, risk:1 }],
      ["Order-generation logic", "10-02", "10-06", "To do", "N", { eff:10 }],
      ["Supplier branch routing", "09-29", "10-03", "Blocked", "A", { eff:6 }],
      ["Prototype walkthrough with ops team", "10-07", "10-07", "To do", "J", { eff:2 }],
      ["Prototype feedback consolidated", "10-08", "10-09", "To do", "F", { eff:4 }],
      ["Prototype Approved", "10-10", "10-10", "To do", "M", { ms:1 }]
    ]],
    ["Build — M1 Core", [
      ["Data model", "10-06", "10-10", "To do", "N", { eff:12 }],
      ["Lead intake", "10-13", "10-16", "To do", "N", { eff:8 }],
      ["Measurement capture", "10-13", "10-20", "To do", "N", { eff:10 }],
      ["Estimate builder", "10-15", "10-29", "To do", "N", { eff:22 }],
      ["Margin-derived pricing", "10-22", "10-29", "To do", "A", { eff:8 }],
      ["Proposal + e-signature", "10-27", "11-05", "To do", "N", { eff:12 }],
      ["Commission tranches on job milestones", "10-30", "11-06", "To do", "A", { eff:6, priv:1 }],
      ["Crew rate override on work orders", "11-02", "11-06", "To do", "N", { eff:5 }],
      ["Internal QA pass — M1", "11-05", "11-09", "To do", "P", { eff:10, priv:1 }],
      ["M1 Build Complete", "11-10", "11-10", "To do", "A", { ms:1 }]
    ]],
    ["Integrations & AI Layer", [
      ["Supplier API credentials", "10-15", "10-20", "To do", "J", { eff:1 }],
      ["Aerial measurement PDF ingest", "10-20", "10-28", "To do", "N", { eff:12 }],
      ["AI estimate review", "10-26", "11-04", "To do", "A", { eff:10 }],
      ["Supplier price-list ingest", "10-28", "11-06", "To do", "N", { eff:10 }],
      ["Price-change dispute flow", "11-03", "11-10", "To do", "F", { eff:6 }],
      ["Notification templates", "11-09", "11-14", "To do", "F", { eff:4 }]
    ]],
    ["Validation, Migration & UAT", [
      ["Legacy CRM export", "11-03", "11-05", "To do", "J", { eff:1 }],
      ["Estimate maths vs 20 historical jobs", "11-03", "11-07", "To do", "P", { eff:10 }],
      ["Migration dry run", "11-06", "11-10", "To do", "P", { eff:8 }],
      ["Reconciliation report", "11-10", "11-12", "To do", "P", { eff:5 }],
      ["Client UAT", "11-12", "11-18", "To do", "T", { eff:6 }],
      ["Defect burn-down", "11-16", "11-20", "To do", "N", { eff:12 }],
      ["UAT Sign-off", "11-21", "11-21", "To do", "M", { ms:1 }]
    ]],
    ["Go-Live & Adoption", [
      ["Cutover plan", "11-17", "11-19", "To do", "P", { eff:4 }],
      ["Training — Branch 1", "11-20", "11-20", "To do", "F", { eff:4 }],
      ["Training — Branch 2", "11-23", "11-23", "To do", "F", { eff:4 }],
      ["Training — Branch 3", "11-24", "11-24", "To do", "F", { eff:4 }],
      ["Cutover", "11-25", "11-26", "To do", "N", { eff:8 }],
      ["Hypercare", "11-23", "11-28", "To do", "N", { eff:10 }],
      ["Adoption tracking dashboard", "11-24", "11-27", "To do", "A", { eff:4 }],
      ["M2 backlog handoff", "11-27", "11-28", "To do", "A", { eff:3 }],
      ["Go-Live", "11-28", "11-28", "To do", "M", { ms:1 }]
    ]]
  ];
  const T = {};
  phases.forEach((ph, i) => {
    const phid = "ph-sb" + (i + 1);
    insert("phases", { id:phid, project_id:P, name:ph[0], order:i, private:false, status:"To do", start:"", due:"" });
    ph[1].forEach((s, j) => {
      const o = s[5] || {}, start = D(s[1]), due = D(s[2]);
      const t = insert("tasks", { id:"t-sb" + (i + 1) + "-" + (j + 1), project_id:P, phase_id:phid, parent_id:"", name:s[0], description:"",
        type:o.ms ? "MILESTONE" : "TASK", status:s[3], priority:"", at_risk:!!o.risk, start, due,
        start_actual:s[3] !== "To do" ? start : "", due_actual:s[3] === "Completed" ? due : "",
        assignee_ids:[who[s[4]]], follower_ids:[], effort_min:(o.eff || 0) * 60, private:!!o.priv, csat_enabled:false });
      T[s[0]] = t.id;
    });
  });
  const tid = n => T[n];
  byId("tasks", tid("Supplier branch routing")).description =
    "<p>Route each order to the supplier branch for the job's region, with that branch's tax rate and send-to list.</p><p><b>Blocked:</b> waiting on Stonebridge's current supplier branch list (3 suppliers × 3 branches).</p>";
  byId("tasks", tid("Scope document sign-off")).description =
    "<p>Mark signs the scope document covering estimating, orders, suppliers and the custom-vs-hard-coded boundary.</p><ul><li>Measurement tokens</li><li>Estimate templates</li><li>Waste and coverage rules</li><li>Trade taxonomy</li></ul>";
  byId("tasks", tid("Estimate-builder logic")).description =
    "<p>Coverage ÷ waste % → round up to a whole purchasable unit. Hips and valleys currently round one unit high — fix before the walkthrough.</p>";
  // subtasks on the prototype
  ["Lead intake screens", "Estimate builder screens", "Order preview", "Supplier routing screen"].forEach((n, k) =>
    insert("tasks", { project_id:P, phase_id:"ph-sb3", parent_id:tid("Clickable prototype"), name:n, description:"", type:"TASK",
      status:k < 2 ? "Completed" : "To do", priority:"", at_risk:false, start:"", due:"", start_actual:"", due_actual:"",
      assignee_ids:["u-afrin"], follower_ids:[], effort_min:0, private:false, csat_enabled:false }));

  [["Scope Locked","Scope document sign-off"], ["Order-generation logic","Estimate-builder logic"], ["Prototype Approved","Prototype walkthrough with ops team"],
   ["Prototype feedback consolidated","Prototype walkthrough with ops team"], ["Data model","Scope Locked"], ["Lead intake","Data model"],
   ["Supplier price-list ingest","Supplier API credentials"], ["Migration dry run","Legacy CRM export"], ["UAT Sign-off","Defect burn-down"],
   ["Go-Live","Cutover"], ["M1 Build Complete","Internal QA pass — M1"]
  ].forEach(d => insert("deps", { task_id:tid(d[0]), blocked_by_id:tid(d[1]), project_id:P }));
  projPhases(P).forEach(ph => recalcPhase(ph.id));

  insert("approvals", { task_id:tid("Scope document sign-off"), project_id:P, approver_ids:["u-mark"], requested_by:"u-anand", due:D("09-29"),
    status:"REQUESTED", type:"Shared", note:"Please review the scope document in Files and approve so we can lock scope.", responded_by:"", responded_at:"" });
  insert("approvals", { task_id:tid("Waste and coverage rules"), project_id:P, approver_ids:["u-anand"], requested_by:"u-nandy", due:D("10-02"),
    status:"REQUESTED", type:"Internal", note:"Rounding rule for hips/valleys changed — need your OK before it goes to Tom.", responded_by:"", responded_at:"" });
  insert("approvals", { task_id:tid("Estimate templates — product list per token"), project_id:P, approver_ids:["u-tom"], requested_by:"u-anand", due:D("09-19"),
    status:"APPROVED", type:"Shared", note:"", responded_by:"u-tom", responded_at:ago(24 * 12) });

  const msg = (thread, author, body, h, priv) => insert("messages", { project_id:P, thread, author_id:author, body, private:!!priv, at:ago(h), mentions:[] });
  msg("general", "u-anand", "Welcome aboard, everyone. This is our shared channel for the Stonebridge build — the plan, files and updates are all in the tabs above.", 24 * 29);
  msg("general", "u-mark", "Thanks Anand. Jess is our day-to-day contact; Tom owns anything estimating.", 24 * 29 - 2);
  msg("general", "u-anand", "@Jess Navarro we still need the current supplier branch list — @@Supplier branch routing is blocked until we have it.", 26);
  msg("general", "u-jess", "On it. Our ABC Supply rep is sending the updated list this week.", 22);
  msg("general", "u-anand", "Heads-up: M2 pricing isn't confirmed yet, so let's not quote it on the call.", 20, true);
  msg("general", "u-tom", "Saw the prototype preview — the estimate layout reads the way our estimators think. Nice.", 5);
  msg("private", "u-nandy", "Estimate-builder rounding is one unit high on hips. Fixing before the walkthrough.", 30);
  msg("private", "u-priya", "Data inventory flagged ~1,800 duplicate contacts in the legacy CRM. Dedupe plan going into the migration doc.", 50);
  msg("task:" + tid("Supplier branch routing"), "u-anand", "Blocked on the branch list from Jess.", 26);

  const up = (author, body, h, priv) => insert("updates", { project_id:P, author_id:author, body, private:!!priv, at:ago(h) });
  up("u-anand", "Discovery is complete. We shadowed two roof inspections, audited the legacy CRM and mapped the data. Next: two KT calls and scope lock by the 26th.", 24 * 19);
  up("u-anand", "Scope lock is slipping by a few days — the sign-off is waiting on Mark. Prototype work started in parallel so the overall date holds.", 24 * 4, true);
  up("u-anand", "Prototype is about 70% built. Walkthrough with the ops team is booked for next week; we need the supplier branch list before routing can be finished.", 18);

  const file = (name, kind, url, body, priv, author, h) => insert("files", { project_id:P, name, kind, url:url || "", body:body || "", private:!!priv, author_id:author, at:ago(h) });
  file("Scope document — v3", "doc", "", "<h3>Scope — {{project.name}}</h3><p>Customer: {{account.name}} · Window {{project.start}} → {{project.due}}</p><p>In scope for M1: lead intake, measurement capture, estimate builder with margin-derived pricing, proposal and e-signature, order generation split by trade.</p><p>Out of scope for M1: customer portal, payroll, inventory.</p>", false, "u-anand", 24 * 8);
  file("Measurement token spec", "doc", "", "<p>Tokens: squares, eaves, rakes, ridge, hips, valleys, pitch. Each template maps tokens to products; coverage ÷ waste % rounds up to a whole purchasable unit.</p>", false, "u-nandy", 24 * 15);
  file("ABC Supply price list — Sept", "link", "https://example.com/abc-price-list-sept.pdf", "", false, "u-jess", 24 * 6);
  file("Internal margin model", "link", "https://example.com/internal-margin-model.xlsx", "", true, "u-anand", 24 * 10);

  /* time: last week submitted + approved, this week in progress */
  const wk = weekStart(todayISO()), last = addDays(wk, -7);
  const te = (u, date, h, task, status) => insert("time_entries", { user_id:u, date, minutes:h * 60, project_id:P, task_id:tid(task), billable:true, notes:"", status });
  [0, 1, 2, 3, 4].forEach(d => {
    te("u-anand", addDays(last, d), 2, "Custom vs hard-coded boundary", "APPROVED");
    te("u-nandy", addDays(last, d), 5, "Estimate-builder logic", "SUBMITTED");
    te("u-afrin", addDays(last, d), 6, "Clickable prototype", "SUBMITTED");
  });
  for(let d = 0; d < Math.min(5, diffDays(wk, todayISO())); d++){
    te("u-anand", addDays(wk, d), 3, "Supplier branch routing", "NOT_SUBMITTED");
    te("u-nandy", addDays(wk, d), 6, "Estimate-builder logic", "NOT_SUBMITTED");
  }

  const act = (text, u, h, task) => insert("activity", { project_id:P, task_id:task ? tid(task) : "", user_id:u, text, at:ago(h) });
  act("created the project from the Sales handoff", "u-anand", 24 * 30);
  act("moved “Supplier branch routing” from In progress to Blocked", "u-anand", 26, "Supplier branch routing");
  act("requested approval on “Scope document sign-off” from Mark Ellison", "u-anand", 24 * 5, "Scope document sign-off");
  act("marked “Estimate-builder logic” at risk", "u-nandy", 30, "Estimate-builder logic");

  insert("notifications", { user_id:"u-anand", text:"Nandy requested your approval on “Waste and coverage rules”", link:"#/projects/" + P + "/plan?t=" + tid("Waste and coverage rules"), read:false, at:ago(28) });
  insert("notifications", { user_id:"u-anand", text:"Tom Becker posted in General chat", link:"#/projects/" + P + "/chat", read:false, at:ago(5) });

  /* ---------------- templates ---------------- */
  const tpl = saveAsTemplate(P, "Field-ops platform rollout");
  update("templates", tpl.id, { description:"13-week implementation: discovery, scope lock, prototype, build, integrations, UAT and go-live. Saved from Stonebridge." });
  insert("templates", { id:"tp-pilot", name:"Quick pilot (4 weeks)", category:"Project", description:"One crew, one branch, four weeks — prove the field app before a full rollout.",
    phases:[
      { key:"a", name:"Kick-off", private:false, tasks:[
        { key:"a1", name:"Kick-off call", type:"TASK", start_offset:0, duration:0, effort_h:1, role:"Solution Architect" },
        { key:"a2", name:"Crew and branch picked", type:"TASK", start_offset:1, duration:2, effort_h:0, role:"Customer" },
        { key:"a3", name:"Pilot scope agreed", type:"MILESTONE", start_offset:4, duration:0, effort_h:0, role:"Customer" } ] },
      { key:"b", name:"Configure", private:false, tasks:[
        { key:"b1", name:"Job types and checklists", type:"TASK", start_offset:5, duration:4, effort_h:8, role:"Implementation Engineer" },
        { key:"b2", name:"Import crew and customers", type:"TASK", start_offset:6, duration:2, effort_h:4, role:"QA & Migration" },
        { key:"b3", name:"Internal test", type:"TASK", start_offset:10, duration:1, effort_h:3, role:"QA & Migration", private:true } ] },
      { key:"c", name:"Run & review", private:false, tasks:[
        { key:"c1", name:"Crew training", type:"TASK", start_offset:12, duration:0, effort_h:2, role:"Product Designer" },
        { key:"c2", name:"Two-week live pilot", type:"TASK", start_offset:13, duration:13, effort_h:6, role:"Implementation Engineer" },
        { key:"c3", name:"Pilot review and go/no-go", type:"MILESTONE", start_offset:27, duration:0, effort_h:2, role:"Customer" } ] }
    ],
    deps:[["a3","a2"],["b3","b1"],["c1","b3"],["c2","c1"],["c3","c2"]] });

  /* ---------------- Harbor: proposed, created from the template ---------------- */
  insert("projects", { id:"p-hm", name:"Service dispatch rollout", account_id:"ac-hm", owner_id:"u-anand", status:"Proposed",
    start:addDays(todayISO(), 14), due:"", start_actual:"", due_actual:"", team_ids:["u-anand","u-nandy","u-priya"], customer_ids:["u-lena"],
    visibility:"EVERYONE", portal_tabs:{ overview:true, plan:true, chat:true, files:true, updates:true },
    portal_welcome:"Welcome, Harbor team. Here's the plan for your dispatch rollout.", fields:{ fee:16000, arr:9600, budget_hours:90, billing:"Fixed fee" },
    template_id:"tp-pilot", archived:false });
  instantiateTemplate(byId("templates", "tp-pilot"), "p-hm", addDays(todayISO(), 14),
    { "Solution Architect":"u-anand", "Implementation Engineer":"u-nandy", "QA & Migration":"u-priya", "Product Designer":"u-afrin", "Customer":"u-lena" });

  /* ---------------- Pinecrest: done ---------------- */
  insert("projects", { id:"p-pc", name:"Crew app pilot", account_id:"ac-pc", owner_id:"u-nandy", status:"Completed",
    start:D("06-02"), due:D("06-27"), start_actual:D("06-02"), due_actual:D("06-26"), team_ids:["u-nandy","u-afrin"], customer_ids:["u-raj"],
    visibility:"EVERYONE", portal_tabs:{ overview:true, plan:true, chat:true, files:true, updates:true }, portal_welcome:"", fields:{ fee:6000, arr:4800, budget_hours:40, billing:"Fixed fee" },
    template_id:"", archived:false });
  insert("phases", { id:"ph-pc1", project_id:"p-pc", name:"Pilot", order:0, private:false, status:"Completed", start:"", due:"" });
  [["Kick-off call","06-02","06-02"],["Crew setup","06-03","06-06"],["Crew training","06-09","06-09"],["Two-week live pilot","06-10","06-24"],["Pilot review","06-26","06-26"]]
    .forEach((s, i) => insert("tasks", { project_id:"p-pc", phase_id:"ph-pc1", parent_id:"", name:s[0], description:"", type:i === 4 ? "MILESTONE" : "TASK",
      status:"Completed", priority:"", at_risk:false, start:D(s[1]), due:D(s[2]), start_actual:D(s[1]), due_actual:D(s[2]),
      assignee_ids:[i === 2 ? "u-afrin" : "u-nandy"], follower_ids:[], effort_min:0, private:false, csat_enabled:false }));
  recalcPhase("ph-pc1");

  db.meta.seeded = true;
  saveDb();
}
