// One-off: tombstone mail the improved sync would have skipped (own inbox copies,
// repeat deliveries, calendar replies). Uses the orbit config in ~/.claude.json; prints no secrets.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const env = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8")).mcpServers.orbit.env;
process.env.ORBIT_URL = env.ORBIT_URL; process.env.ORBIT_TOKEN = env.ORBIT_TOKEN;
const C = await import("../lib/client.js");
const all = (await C.all({ fresh: true })).sources.filter(s => !s.deleted && s.kind === "email");
const own = /(^|<)anand(\.v)?@fieldproxy\.com/i, now = new Date().toISOString(), kill = [], seen = {};
for(const s of all.sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)))){
  const from = (String(s.from).match(/[\w.%+'-]+@[\w.-]+\.\w+/) || [""])[0].toLowerCase();
  const sig = from + "|" + String(s.subject).trim().toLowerCase() + "|" + s.size;
  let why = "";
  if(s.direction === "in" && own.test(s.from)) why = "own copy";
  else if(/^(accepted|declined|tentative|tentatively accepted|updated invitation|invitation):/i.test(s.subject)) why = "calendar";
  else if(seen[sig] && Math.abs(new Date(s.occurred_at) - seen[sig]) < 600000) why = "duplicate";
  else seen[sig] = new Date(s.occurred_at);
  if(why){ kill.push({ ...s, deleted: true, updated_at: now }); console.log("remove:", why.padEnd(9), s.occurred_at.slice(0, 16), s.subject.slice(0, 50)); }
}
const r = await C.save({ sources: kill });
console.log("tombstoned", r.saved, "of", all.length, "emails; kept", all.length - kill.length);
