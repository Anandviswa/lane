// A small in-memory stand-in for the Apps Script services Orbit's server uses,
// so Code.gs / Mail.gs can be tested with Node before anyone deploys them.
import fs from "node:fs";
import vm from "node:vm";

class Range {
  constructor(sh, r, c, nr, nc){ Object.assign(this, { sh, r, c, nr, nc }); }
  setValues(v){
    if(v.length !== this.nr || v.some(row => row.length !== this.nc)) throw new Error(`setValues shape ${v.length}x${v[0]?.length} != ${this.nr}x${this.nc}`);
    v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, String(x))));
    return this;
  }
  getDisplayValues(){
    const out = [];
    for(let i = 0; i < this.nr; i++){ const row = []; for(let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); out.push(row); }
    return out;
  }
  setNumberFormat(){ return this; } setFontColor(){ return this; } setFontStyle(){ return this; } setFontWeight(){ return this; }
}
class Sheet {
  constructor(name){ this.name = name; this.cells = []; }
  getName(){ return this.name; }
  get(r, c){ return (this.cells[r - 1] || [])[c - 1] ?? ""; }
  set(r, c, v){ while(this.cells.length < r) this.cells.push([]); const row = this.cells[r - 1]; while(row.length < c) row.push(""); row[c - 1] = v; }
  getLastRow(){ for(let i = this.cells.length; i > 0; i--) if(this.cells[i - 1].some(x => x !== "")) return i; return 0; }
  getLastColumn(){ return Math.max(0, ...this.cells.map(r => { for(let j = r.length; j > 0; j--) if(r[j - 1] !== "") return j; return 0; })); }
  getMaxRows(){ return Math.max(1000, this.cells.length); }
  getMaxColumns(){ return Math.max(26, this.getLastColumn()); }
  getRange(a, b, c, d){ if(typeof a === "string") return new Range(this, 1, 1, 1, 1); return new Range(this, a, b, c || 1, d || 1); }
  setFrozenRows(){}
  deleteRow(n){ this.cells.splice(n - 1, 1); }
}
export function makeGas({ files, drive = true } = {}){
  const sheets = [new Sheet("Sheet1")];
  const props = {}, logs = [], cache = {}, driveFiles = {}, folders = {}, triggers = [], fetches = [];
  let fid = 0;
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
  };
  const mkFolder = (name) => {
    const id = "fo" + (++fid);
    const f = folders[id] = { id, name, kids: {}, getId: () => id, getName: () => name,
      getFoldersByName: n => { const k = Object.values(f.kids).filter(x => x.getName && x.getName() === n && x.isFolder); let i = 0; return { hasNext: () => i < k.length, next: () => k[i++] }; },
      createFolder: n => { const c = mkFolder(n); c.isFolder = true; f.kids[c.id] = c; return c; },
      createFile: (n, content, mime) => { const id2 = "fi" + (++fid); const file = { id: id2, name: n, content, mime, getId: () => id2, getUrl: () => "https://drive.example/" + id2, getBlob: () => ({ getDataAsString: () => file.content }), getName: () => n }; driveFiles[id2] = file; return file; },
    };
    return f;
  };
  const root = mkFolder("root");
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; },
      getProperties: () => ({ ...props }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { getUuid: () => crypto.randomUUID(), sleep: () => {},
      newBlob: (s) => ({ getDataAsString: () => s }) },
    Logger: { log: m => logs.push(String(m)) },
    ContentService: { createTextOutput: s => ({ s, setMimeType(){ return this; }, getContent(){ return this.s; } }), MimeType: { JSON: "json", JAVASCRIPT: "js" } },
    DriveApp: drive ? { getRootFolder: () => root, getFolderById: id => folders[id], getFileById: id => { if(!driveFiles[id]) throw new Error("No file " + id); return driveFiles[id]; } } : undefined,
    ScriptApp: { getProjectTriggers: () => triggers.slice(), newTrigger: fn => ({ timeBased: () => ({ everyMinutes: n => ({ create: () => { triggers.push({ fn, n, getHandlerFunction: () => fn }); } }) }) }),
                 deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1) },
    UrlFetchApp: { fetch: (url, opt) => { fetches.push({ url, opt }); if(!ctx.__fetch) throw new Error("no fetch stub"); return ctx.__fetch(url, opt); } },
    console, Date, JSON, Math, Object, Array, String, Number, Boolean, Error, RegExp, crypto,
  };
  vm.createContext(ctx);
  for(const f of files) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  return { ctx, sheets, props, logs, driveFiles, triggers, fetches, ss };
}
export function call(gas, body){
  const out = gas.ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(out.getContent());
}
