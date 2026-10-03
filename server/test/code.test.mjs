// node server/test/code.test.mjs — exercises Code.gs against the in-memory mock.
import assert from "node:assert/strict";
import { makeGas, call } from "./gas_mock.mjs";

const gas = makeGas({ files: ["server/Code.gs"] });
gas.ctx.setup();
const T = gas.props.TOKEN;
assert.ok(T && T.startsWith("orb_"), "setup makes a secret");
assert.ok(gas.ss.getSheetByName("tasks") && !gas.ss.getSheetByName("Sheet1"), "tabs made, Sheet1 removed");

assert.equal(call(gas, { token: "nope", action: "ping" }).error, "bad token");
assert.equal(call(gas, { token: T, action: "ping" }).ok, true);

let all = call(gas, { token: T, action: "all" });
assert.equal(all.rows.users.length, 2, "two base users");
assert.equal(all.rows.users[0].capacity_min, 2400, "number decoded");
assert.equal(all.rows.users[0].deleted, false, "boolean decoded");

// re-running setup keeps edits (keepNewer)
gas.ctx.setup();
assert.equal(call(gas, { token: T, action: "all" }).rows.users.length, 2);

const t0 = "2026-10-03T10:00:00.000Z", t1 = "2026-10-03T11:00:00.000Z";
const task = { id: "t1", project_id: "p1", name: "First", status: "To do", start: "2026-10-04", due: "2026-10-06",
  at_risk: false, assignee_ids: ["u-anand"], effort_min: 60, created_at: t0, updated_at: t1, deleted: false,
  new_field: { a: 1 } };
let r = call(gas, { token: T, action: "save", rows: { tasks: [task] } });
assert.deepEqual([r.ok, r.saved, r.skipped], [true, 1, 0]);
let back = call(gas, { token: T, action: "all" }).rows.tasks.find(x => x.id === "t1");
assert.equal(back.start, "2026-10-04");
assert.deepEqual(back.assignee_ids, ["u-anand"]);
assert.deepEqual(back.new_field, { a: 1 }, "new column, json type");
assert.equal(back.at_risk, false);

// stale write refused, newer accepted
r = call(gas, { token: T, action: "save", rows: { tasks: [{ ...task, name: "stale", updated_at: t0 }] } });
assert.equal(r.skipped, 1);
r = call(gas, { token: T, action: "save", rows: { tasks: [{ ...task, name: "Second", updated_at: "2026-10-03T12:00:00.000Z" }] } });
assert.equal(r.saved, 1);
back = call(gas, { token: T, action: "all" }).rows.tasks.find(x => x.id === "t1");
assert.equal(back.name, "Second");

// since filter
const since = call(gas, { token: T, action: "all", since: "2026-10-03T11:30:00.000Z" }).rows.tasks;
assert.equal(since.length, 1);
assert.equal(call(gas, { token: T, action: "all", since: "2026-10-03T12:30:00.000Z" }).rows.tasks.length, 0);

// GET form (the app's pull)
const g = JSON.parse(gas.ctx.doGet({ parameter: { action: "all", token: T } }).getContent());
assert.equal(g.ok, true);

// duplicate ids in one save
r = call(gas, { token: T, action: "save", rows: { tasks: [{ ...task, id: "t2", name: "a" }, { ...task, id: "t2", name: "b" }] } });
assert.equal(r.saved, 1);
assert.equal(call(gas, { token: T, action: "all" }).rows.tasks.filter(x => x.id === "t2")[0].name, "b");

// too-long cell
r = call(gas, { token: T, action: "save", rows: { files: [{ id: "f1", body: "x".repeat(50000), updated_at: t1 }] } });
assert.equal(r.ok, false); assert.match(r.error, /limit/);

// bad tab name
assert.equal(call(gas, { token: T, action: "save", rows: { "Bad Tab": [{ id: "x" }] } }).ok, false);

// selfTest passes
gas.ctx.selfTest();
assert.ok(gas.logs.includes("All checks passed."), gas.logs.slice(-9).join("\n"));
console.log("Code.gs: all tests passed");
