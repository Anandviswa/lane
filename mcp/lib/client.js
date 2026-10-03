// Talks to the Orbit Apps Script web app. Keeps a local copy of every row,
// refreshed incrementally (only rows changed since the last read), so most
// tool calls cost one small request.
const URL_ = process.env.ORBIT_URL || "";
const TOKEN = process.env.ORBIT_TOKEN || "";

export function configured(){ return !!(URL_ && TOKEN); }

export async function call(action, args = {}, { timeoutMs = 90000 } = {}){
  if(!configured()) throw new Error("Orbit isn't connected: set ORBIT_URL and ORBIT_TOKEN in the claude mcp add command.");
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetch(URL_, { method: "POST", redirect: "follow", signal: ctl.signal,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...args, token: TOKEN, action }) });
    text = await res.text();
  } catch(e){
    throw new Error(e.name === "AbortError" ? "Orbit didn't answer within " + timeoutMs / 1000 + "s" : "Can't reach Orbit: " + e.message);
  } finally { clearTimeout(t); }
  let j;
  try { j = JSON.parse(text); }
  catch(e){ throw new Error("Orbit answered with something that isn't JSON (HTTP " + res.status + "). Is ORBIT_URL the /exec URL of the deployment?"); }
  if(!j.ok) throw new Error(j.error === "bad token" ? "Orbit refused the secret (ORBIT_TOKEN doesn't match)" : (j.error || "Orbit refused the request"));
  return j;
}

/* ---- the local copy ---- */
let rows = null, lastNow = "", readAt = 0;
const FRESH_MS = 15000;

function merge(incoming){
  for(const c of Object.keys(incoming || {})){
    rows[c] = rows[c] || [];
    const idx = new Map(rows[c].map((r, i) => [r.id, i]));
    for(const r of incoming[c]){
      const i = idx.get(r.id);
      if(i === undefined){ idx.set(r.id, rows[c].length); rows[c].push(r); }
      else if(String(r.updated_at || "") >= String(rows[c][i].updated_at || "")) rows[c][i] = r;
    }
  }
}

/** Every row Orbit holds, deleted ones included. */
export async function all({ fresh = false } = {}){
  if(rows && !fresh && Date.now() - readAt < FRESH_MS) return rows;
  const j = await call("all", { since: rows ? lastNow : "" });
  if(!rows) rows = {};
  merge(j.rows);
  lastNow = j.now; readAt = Date.now();
  return rows;
}

/** Save changed rows, then fold them into the local copy. */
export async function save(byColl){
  const n = Object.values(byColl).reduce((s, l) => s + l.length, 0);
  if(!n) return { saved: 0, skipped: 0 };
  const j = await call("save", { rows: byColl });
  if(rows) merge(JSON.parse(JSON.stringify(byColl)));
  return { saved: j.saved, skipped: j.skipped };
}

export function forget(){ rows = null; lastNow = ""; readAt = 0; }
