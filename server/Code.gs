/* =====================================================================
   Orbit — the Google Sheets backend (Apps Script web app)

   One Sheet, one tab per collection, one row per record, one column per
   field. Row 1 = field names. Row 2 = the type each column holds
   (string | number | boolean | json), so values come back as what went in.
   Every cell is stored as plain text: Sheets never turns "2026-10-04" into
   a Date.

   The script only stores, authenticates and locks. All logic lives in the
   callers (the Orbit app and the Orbit MCP server), so this file rarely
   changes — and every change here needs Deploy → Manage deployments →
   pencil → Version: New version → Deploy.

   Protocol (all JSON):
     POST {token, action:"save", rows:{<tab>:[record,…]}}      → {ok:true, saved, skipped}
     POST {token, action:"all", since?}                          → {ok, now, rows:{<tab>:[…]}}
     GET  ?action=all&token=…&since=…                            → same (the app's pull)
     POST/GET action "ping"                                      → {ok, now, tabs}
   Mail + sources actions live in Mail.gs.

   Setup: run setup() once from the editor. It creates the tabs, the base
   rows, the Drive folder and the secret, and prints the secret in the log.
   ===================================================================== */

var TABS = {
  accounts:      ['name','domain','industry','logo_color','kind'],
  users:         ['name','email','type','role','account_id','capacity_min','status'],
  projects:      ['name','account_id','owner_id','status','start','due','start_actual','due_actual','team_ids','customer_ids',
                  'visibility','portal_tabs','portal_welcome','fields','template_id','archived'],
  phases:        ['project_id','name','order','start','due','status','private'],
  tasks:         ['project_id','phase_id','parent_id','name','description','type','status','priority','at_risk','start','due',
                  'start_actual','due_actual','assignee_ids','follower_ids','effort_min','private','csat_enabled',
                  'doer','kind','autonomy','agent_brief','app_ref','session_ref','source_ref'],
  deps:          ['project_id','task_id','blocked_by_id'],
  approvals:     ['project_id','task_id','approver_ids','requested_by','due','status','type','note','responded_by','responded_at'],
  messages:      ['project_id','thread','author_id','body','private','mentions','at'],
  files:         ['project_id','name','kind','url','body','private','author_id','at'],
  updates:       ['project_id','author_id','body','private','at'],
  templates:     ['name','category','description','phases','deps','source_project_id'],
  time_entries:  ['user_id','project_id','task_id','date','minutes','billable','notes','status','submitted_at','reviewed_by','reviewed_at'],
  activity:      ['project_id','task_id','user_id','text','at'],
  notifications: ['user_id','text','link','read','at'],
  decisions:     ['project_id','text','decided_by','at','source','source_ref','status'],
  agent_runs:    ['task_id','project_id','agent','session_ref','started_at','ended_at','outcome','note'],
  sources:       ['kind','project_id','account_id','occurred_at','direction','from','to','subject','people','summary',
                  'file_id','file_url','external_id','thread_id','size','processed_at']
};
var BASE = ['id','created_at','updated_at','deleted'];
var MAX_CELL = 49000;          // Sheets refuses cells over 50,000 characters
var PROPS = PropertiesService.getScriptProperties();

/* ------------------------------------------------------------------ setup */
function setup(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function(name){ ensureTab_(ss, name); });
  var blank = ss.getSheetByName('Sheet1');
  if(blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  /* the base rows: you, Claude, and your own company */
  var t = new Date().toISOString();
  saveRows_({
    accounts: [{ id:'ac-us', name:'Fieldproxy', domain:'fieldproxy.com', industry:'', logo_color:'#221C29', kind:'vendor',
                 created_at:t, updated_at:t, deleted:false }],
    users: [
      { id:'u-anand', name:'Anand Viswanathan', email:'anand@fieldproxy.com', type:'TEAM', role:'Solution Architect',
        account_id:'ac-us', capacity_min:2400, status:'ACTIVE', created_at:t, updated_at:t, deleted:false },
      { id:'u-claude', name:'Claude', email:'', type:'TEAM', role:'AI agent',
        account_id:'ac-us', capacity_min:0, status:'ACTIVE', created_at:t, updated_at:t, deleted:false }
    ]
  }, { keepNewer:true });

  if(!PROPS.getProperty('TOKEN')){
    PROPS.setProperty('TOKEN', 'orb_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  }
  if(typeof ensureSourcesFolder_ === 'function') ensureSourcesFolder_();
  Logger.log('Orbit is set up. Tabs: ' + Object.keys(TABS).length + '.');
  Logger.log('Your Orbit secret (paste it into Orbit Settings and the claude mcp add command; keep it private):');
  Logger.log(PROPS.getProperty('TOKEN'));
}

/* Prints the secret again if you lose it. */
function showSecret(){ Logger.log(PROPS.getProperty('TOKEN') || 'No secret yet - run setup() first.'); }

/* Makes a new secret. Every device and the MCP server then need the new one. */
function rotateSecret(){
  PROPS.setProperty('TOKEN', 'orb_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  showSecret();
}

function ensureTab_(ss, name){
  var sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    var cols = BASE.concat(TABS[name] || []);
    sh.getRange(1, 1, 2, cols.length).setNumberFormat('@')
      .setValues([cols, cols.map(function(c){ return c === 'deleted' ? 'boolean' : 'string'; })]);
    sh.setFrozenRows(2);
    sh.getRange('2:2').setFontColor('#9AA3AD').setFontStyle('italic');
    sh.getRange('1:1').setFontWeight('bold');
  }
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
  return sh;
}

/* ------------------------------------------------------------------ http */
function doGet(e){
  var p = (e && e.parameter) || {};
  return route_(p.action || 'ping', p.token, { since:p.since || '' });
}
function doPost(e){
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err){ return json_({ ok:false, error:'Body is not JSON' }); }
  return route_(body.action, body.token, body);
}
function route_(action, token, args){
  try {
    if(!token || token !== PROPS.getProperty('TOKEN')) return json_({ ok:false, error:'bad token' });
    if(action === 'ping')  return json_({ ok:true, now:new Date().toISOString(), tabs:Object.keys(TABS) });
    if(action === 'all')   return json_(allSince_(args.since || ''));
    if(action === 'save'){
      var r = withLock_(function(){ return saveRows_(args.rows || {}, {}); });
      return json_({ ok:true, saved:r.saved, skipped:r.skipped });
    }
    if(typeof mailRoute_ === 'function'){
      var m = mailRoute_(action, args);
      if(m) return json_(m);
    }
    return json_({ ok:false, error:'Unknown action: ' + action });
  } catch(err){
    return json_({ ok:false, error:String(err && err.message || err) });
  }
}
function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function withLock_(fn){
  var lock = LockService.getScriptLock();
  if(!lock.tryLock(30000)) throw new Error('Orbit is busy - try again in a moment');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ read */
function allSince_(since){
  var now = new Date().toISOString();          // taken before reading, so nothing written meanwhile is missed next time
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = {};
  ss.getSheets().forEach(function(sh){
    var name = sh.getName();
    if(!/^[a-z_]+$/.test(name)) return;
    var t = readTab_(sh);
    out[name] = t.rows.filter(function(r){ return !since || String(r.updated_at || '') > since; });
  });
  return { ok:true, now:now, rows:out };
}
function readTab_(sh){
  var last = sh.getLastRow(), cols = sh.getLastColumn();
  if(last < 2 || cols < 1) return { head:[], types:[], rows:[], ids:{} };
  var v = sh.getRange(1, 1, last, cols).getDisplayValues();
  var head = v[0], types = v[1], rows = [], ids = {};
  for(var i = 2; i < v.length; i++){
    if(!v[i][0]) continue;
    var r = {};
    for(var c = 0; c < head.length; c++) if(head[c]) r[head[c]] = decode_(v[i][c], types[c]);
    rows.push(r); ids[r.id] = i + 1;          // sheet row number
  }
  return { head:head, types:types, rows:rows, ids:ids };
}
function decode_(s, type){
  if(type === 'number')  return s === '' ? '' : Number(s);
  if(type === 'boolean') return s === 'true';
  if(type === 'json'){ if(s === '') return ''; try { return JSON.parse(s); } catch(e){ return s; } }
  return s;
}
function typeOf_(v){
  if(v === null || v === undefined || v === '') return '';
  if(typeof v === 'number')  return 'number';
  if(typeof v === 'boolean') return 'boolean';
  if(typeof v === 'object')  return 'json';
  return 'string';
}
function encode_(v, type){
  if(v === null || v === undefined) return '';
  if(type === 'json')    return JSON.stringify(v);
  if(type === 'boolean') return v === true || v === 'true' ? 'true' : 'false';
  if(typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ------------------------------------------------------------------ write */
/* Upserts by id. A row whose stored updated_at is newer than the incoming
   one is skipped (a stale device can't overwrite a newer write). New fields
   become new columns; a column's type is set by the first non-empty value. */
function saveRows_(byTab, opt){
  var ss = SpreadsheetApp.getActiveSpreadsheet(), saved = 0, skipped = 0;
  Object.keys(byTab).forEach(function(name){
    if(!/^[a-z_]+$/.test(name)) throw new Error('Bad collection name: ' + name);
    var seen = {}, list = [];
    (byTab[name] || []).forEach(function(r){ if(r && r.id && seen[r.id] !== undefined) list[seen[r.id]] = r; else { if(r && r.id) seen[r.id] = list.length; list.push(r); } });
    if(!list.length) return;
    var sh = ensureTab_(ss, name), t = readTab_(sh);
    var head = t.head.length ? t.head.slice() : BASE.concat(TABS[name] || []);
    var types = t.types.length ? t.types.slice() : head.map(function(c){ return c === 'deleted' ? 'boolean' : 'string'; });
    var headChanged = false, appends = [];
    list.forEach(function(rec){
      if(!rec || !rec.id) throw new Error(name + ': a record has no id');
      Object.keys(rec).forEach(function(k){
        var ix = head.indexOf(k), ty = typeOf_(rec[k]);
        if(ix === -1){ head.push(k); types.push(ty || 'string'); headChanged = true; }
        else if(ty && types[ix] === 'string' && ty !== 'string' && columnEmpty_(t.rows, k)){ types[ix] = ty; headChanged = true; }
      });
    });
    if(headChanged){
      sh.getRange(1, 1, 2, head.length).setNumberFormat('@').setValues([head, types]);
    }
    list.forEach(function(rec){
      var line = head.map(function(k, ix){
        var cell = encode_(rec[k], types[ix]);
        if(cell.length > MAX_CELL) throw new Error(name + '.' + k + ' on ' + rec.id + ' is ' + cell.length + ' characters; the limit is ' + MAX_CELL + '. Store long text as a file.');
        return cell;
      });
      var rowNo = t.ids[rec.id];
      if(rowNo){
        var cur = t.rows.filter(function(r){ return r.id === rec.id; })[0] || {};
        if(String(cur.updated_at || '') > String(rec.updated_at || '')){ skipped++; return; }
        if(opt.keepNewer && cur.updated_at){ skipped++; return; }
        sh.getRange(rowNo, 1, 1, line.length).setNumberFormat('@').setValues([line]);
      } else {
        appends.push(line); t.ids[rec.id] = -1;
      }
      saved++;
    });
    if(appends.length){
      var start = Math.max(sh.getLastRow(), 2) + 1;
      sh.getRange(start, 1, appends.length, head.length).setNumberFormat('@').setValues(appends);
    }
  });
  return { saved:saved, skipped:skipped };
}
function columnEmpty_(rows, k){
  for(var i = 0; i < rows.length; i++) if(rows[i][k] !== '' && rows[i][k] !== undefined) return false;
  return true;
}

/* ------------------------------------------------------------------ test */
/* Run from the editor after setup(). Writes, reads, tombstones and removes a
   test row, and checks dates, booleans, arrays and the stale-write guard. */
function selfTest(){
  var id = 'zz-selftest-' + Date.now(), t1 = new Date(Date.now() - 60000).toISOString(), t2 = new Date().toISOString();
  var rec = { id:id, project_id:'', name:'Orbit self-test', type:'TASK', status:'To do', start:'2026-10-04', due:'2026-10-05',
              at_risk:true, assignee_ids:['u-anand'], effort_min:90, created_at:t1, updated_at:t2, deleted:false };
  withLock_(function(){ saveRows_({ tasks:[rec] }, {}); });
  var back = allSince_('').rows.tasks.filter(function(r){ return r.id === id; })[0];
  var checks = [
    ['row comes back', !!back],
    ['date stays text', back && back.start === '2026-10-04'],
    ['boolean comes back', back && back.at_risk === true],
    ['array comes back', back && Array.isArray(back.assignee_ids) && back.assignee_ids[0] === 'u-anand'],
    ['number comes back', back && back.effort_min === 90]
  ];
  var stale = withLock_(function(){ return saveRows_({ tasks:[Object.assign({}, rec, { name:'stale', updated_at:t1 })] }, {}); });
  checks.push(['older write is refused', stale.skipped === 1]);
  withLock_(function(){ saveRows_({ tasks:[Object.assign({}, rec, { deleted:true, updated_at:new Date().toISOString() })] }, {}); });
  var gone = allSince_('').rows.tasks.filter(function(r){ return r.id === id; })[0];
  checks.push(['delete is a tombstone', gone && gone.deleted === true]);
  /* clean up the test row */
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('tasks'), ids = readTab_(sh).ids;
  if(ids[id]) sh.deleteRow(ids[id]);
  checks.forEach(function(c){ Logger.log((c[1] ? 'PASS  ' : 'FAIL  ') + c[0]); });
  Logger.log(checks.every(function(c){ return c[1]; }) ? 'All checks passed.' : 'Something failed - send this log to Claude.');
}
