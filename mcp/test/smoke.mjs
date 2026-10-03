// ORBIT_URL=… ORBIT_TOKEN=… node test/smoke.mjs
// Exercises every write path against a live Orbit (the local test server or the
// real Sheet) on a throwaway project, then deletes what it made.
import assert from "node:assert/strict";
import * as T from "../lib/tools.js";
import * as client from "../lib/client.js";

const name = "ZZ smoke " + Date.now();
const today = new Date().toISOString().slice(0, 10);
const step = (s) => console.log("  ✓ " + s);

const p = await T.createProject({ name, account: "ZZ Smoke Co", domain: "zz-smoke.example", start: today });
assert.ok(p.project_id); step("create project");

const plan = await T.createPlan({ project: p.project_id, phases: [
  { name: "Build", tasks: [
    { key: "a", name: "Design", start: today, duration_days: 2, doer: "anand", kind: "design" },
    { key: "b", name: "Build it", start: today, duration_days: 3, doer: "claude", kind: "build", autonomy: "do", agent_brief: "Goal: x", app_ref: "zz_app" },
    { key: "c", name: "Ship", type: "MILESTONE", due: today } ] } ],
  deps: [{ task: "b", waits_on: "a" }, { task: "c", waits_on: "b" }, { task: "a", waits_on: "c" }] });
assert.equal(plan.created, 3);
assert.equal(plan.dependency_errors.length, 1, "the loop is refused"); step("plan + deps, loop refused");

const proj = await T.getProject({ project: name });
const tasks = proj.phases[0].tasks, B = tasks.find(t => t.name === "Build it"), A = tasks.find(t => t.name === "Design");
assert.ok(B.start > A.due, "dependent task moved after its blocker"); step("dependency dates moved");
assert.equal(B.doer, "claude"); assert.equal(B.agent_brief, "Goal: x");

const tod = await T.today();
assert.ok(tod.projects[p.project_id].for_claude.some(t => t.id === B.id)); step("today lists Claude's task");

const u = await T.updateTask({ task: B.id, status: "In progress", note: "Started", session_ref: "sess-1" });
assert.ok(u.changed.includes("status")); step("update task + note");

const ap = await T.requestApproval({ task: B.id, note: "Push zz_app v2" });
let st = await T.approvalStatus({ approval: ap.approval_id });
assert.equal(st.status, "REQUESTED"); step("approval requested");

await T.logDecision({ project: p.project_id, text: "Smoke decisions are fine", source: "smoke test" });
await T.postUpdate({ project: p.project_id, body: "Smoke update" });
await T.attach({ project: p.project_id, name: "Smoke link", url: "https://example.com", task: B.id });
await T.logRun({ task: B.id, agent: "builder", outcome: "done" });
const q = await T.query({ collection: "decisions", project: p.project_id });
assert.equal(q.total, 1); step("decision, update, attach, run, query");

const ex = await T.exportAll({ project: p.project_id });
assert.ok(ex.counts.tasks >= 3); step("export → " + ex.folder);

const lp = await T.listProjects();
assert.ok(lp.some(x => x.id === p.project_id)); step("list projects");

// clean up: tombstone everything the smoke test made
const all = await client.all({ fresh: true }), out = {}, now = new Date().toISOString();
for(const c of Object.keys(all)) for(const r of all[c]) {
  if(!r.deleted && (r.id === p.project_id || r.project_id === p.project_id || r.id === p.account_id || (r.task_id && tasks.some(t => t.id === r.task_id)))
     && !(c === "users")) (out[c] = out[c] || []).push({ ...r, deleted: true, updated_at: now });
}
await client.save(out); step("cleaned up");
console.log("orbit-mcp smoke: all passed");
