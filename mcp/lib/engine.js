// The Orbit app's own rules, run in Node. src/core.js is loaded as-is into a
// sandbox, so a task Claude moves, a dependency Claude adds or a phase Claude
// recalculates follows exactly the rules the app uses. The sandbox's db is
// filled from the Sheet before each tool call; whatever the rules mark dirty
// is what gets saved back.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, "../../src/core.js");

export function createEngine(actorId = "u-claude"){
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const ctx = vm.createContext({
    localStorage, console, Date, JSON, Math, Object, Array, String, Number, Boolean, Error, RegExp, Set,
    document: { getElementById: () => null, addEventListener(){}, visibilityState: "hidden" },
    navigator: { onLine: false }, setTimeout: () => 0, clearTimeout(){},
  });
  vm.runInContext(fs.readFileSync(CORE, "utf8"), ctx, { filename: "core.js" });
  vm.runInContext(`
    function __set(d){ db = d; }
    function __get(){ return db; }
    function __as(id){ session.user = id; }
  `, ctx);
  /* const declarations aren't globals in a vm context; surface the ones tools use */
  ctx.COLLS = vm.runInContext("COLLS", ctx);
  ctx.TASK_STATUSES = vm.runInContext("TASK_STATUSES", ctx);

  const E = {
    ctx,
    /** Replace the sandbox db with rows from the Sheet (deleted rows included). */
    load(rowsByColl){
      const d = ctx.blankDb();
      for(const c of Object.keys(rowsByColl || {})) d[c] = (rowsByColl[c] || []).map(r => ({ ...r }));
      ctx.__set(d); ctx.__as(actorId);
      store["orbit.dirty.v1"] = "[]";
    },
    db(){ return ctx.__get(); },
    /** Records changed since load, grouped by collection, ready for save. */
    dirty(){
      const keys = JSON.parse(store["orbit.dirty.v1"] || "[]"), out = {}, d = ctx.__get();
      for(const k of keys){
        const i = k.indexOf(":"), c = k.slice(0, i), id = k.slice(i + 1);
        const r = (d[c] || []).find(x => x.id === id);
        if(r) (out[c] = out[c] || []).push(r);
      }
      return out;
    },
    clearDirty(){ store["orbit.dirty.v1"] = "[]"; },
  };
  return E;
}
