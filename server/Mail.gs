/* =====================================================================
   Orbit — mail, transcripts and notes (the "sources")

   Zoho mail comes in through the Zoho Mail API (read-only: it never sends,
   moves or marks mail). Every 15 minutes mailSync() reads new mail in Inbox
   and Sent, keeps only mail to or from a client domain (the `domain` on an
   Orbit account), saves the text as a file in the "Orbit Sources" Drive
   folder and adds a row to the `sources` tab. Transcripts and notes are
   filed the same way through the source_add action.

   One-time Zoho connection (no code edits):
     1. api-console.zoho.<dc> → Add client → Self Client → Create.
     2. Generate code: scopes
          ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ
        time 10 minutes → Create → copy the code.
     3. Apps Script → Project Settings → Script properties → add
          ZOHO_DC            com | in | eu | com.au | jp  (from your Zoho address bar)
          ZOHO_CLIENT_ID     from the Self Client
          ZOHO_CLIENT_SECRET from the Self Client
          ZOHO_GRANT_CODE    the code from step 2
     4. Run zohoConnect() from the editor. It swaps the code for a lasting
        token, deletes the code, files the last 7 days of client mail and
        turns on the 15-minute sync.
   ===================================================================== */

var MAIL_BUDGET_MS = 270000;      // stop well inside Apps Script's 6-minute limit
var FIRST_RUN_DAYS = 7;

/* ------------------------------------------------------------------ routes */
function mailRoute_(action, args){
  if(action === 'source_get')    return sourceGet_(args);
  if(action === 'source_add')    return sourceAdd_(args);
  if(action === 'mail_sync_now') return { ok:true, result:mailSync() };
  return null;
}

/* ------------------------------------------------------------------ Drive */
function ensureSourcesFolder_(){
  var id = PROPS.getProperty('SOURCES_FOLDER_ID');
  if(id){ try { return DriveApp.getFolderById(id); } catch(e){} }
  var root = DriveApp.getRootFolder(), it = root.getFoldersByName('Orbit Sources');
  var f = it.hasNext() ? it.next() : root.createFolder('Orbit Sources');
  PROPS.setProperty('SOURCES_FOLDER_ID', f.getId());
  return f;
}
function subFolder_(name){
  var top = ensureSourcesFolder_(), clean = String(name || 'Unassigned').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Unassigned';
  var it = top.getFoldersByName(clean);
  return it.hasNext() ? it.next() : top.createFolder(clean);
}
function srcId_(){ return 'sr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ------------------------------------------------------------------ sources */
function sourceAdd_(a){
  if(!a.text) throw new Error('source_add needs text');
  var accName = a.account_id ? accountName_(a.account_id) : '';
  var folder = subFolder_(accName || 'Unassigned');
  var when = a.occurred_at || new Date().toISOString();
  var title = (when.slice(0, 10) + ' ' + (a.kind || 'note') + ' - ' + (a.subject || '')).slice(0, 180);
  var file = folder.createFile(title + '.txt', String(a.text), 'text/plain');
  var t = new Date().toISOString(), row = {
    id:srcId_(), created_at:t, updated_at:t, deleted:false, kind:a.kind || 'note', project_id:a.project_id || '', account_id:a.account_id || '',
    occurred_at:when, direction:'', from:a.from || '', to:'', subject:a.subject || '', people:a.people || '', summary:'',
    file_id:file.getId(), file_url:file.getUrl(), external_id:a.external_id || '', thread_id:'', size:String(a.text).length, processed_at:''
  };
  withLock_(function(){ saveRows_({ sources:[row] }, {}); });
  return { ok:true, id:row.id, file_url:row.file_url };
}
function sourceGet_(a){
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('sources');
  var r = sh ? readTab_(sh).rows.filter(function(x){ return x.id === a.id; })[0] : null;
  if(!r) throw new Error('No source ' + a.id);
  var text = DriveApp.getFileById(r.file_id).getBlob().getDataAsString();
  var off = Math.max(0, +a.offset || 0), len = Math.max(1, Math.min(+a.length || 40000, 100000));
  return { ok:true, total:text.length, offset:off, text:text.slice(off, off + len) };
}
function accountName_(id){
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('accounts');
  var r = sh ? readTab_(sh).rows.filter(function(x){ return x.id === id; })[0] : null;
  return r ? r.name : '';
}

/* ------------------------------------------------------------------ Zoho auth */
function zohoConnect(){
  var dc = PROPS.getProperty('ZOHO_DC'), cid = PROPS.getProperty('ZOHO_CLIENT_ID'),
      sec = PROPS.getProperty('ZOHO_CLIENT_SECRET'), code = PROPS.getProperty('ZOHO_GRANT_CODE');
  if(!dc || !cid || !sec || !code) throw new Error('Add ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_GRANT_CODE in Project Settings → Script properties first.');
  var res = UrlFetchApp.fetch('https://accounts.zoho.' + dc + '/oauth/v2/token', { method:'post', muteHttpExceptions:true,
    payload:{ code:code, grant_type:'authorization_code', client_id:cid, client_secret:sec } });
  var j = JSON.parse(res.getContentText() || '{}');
  if(!j.refresh_token) throw new Error('Zoho did not give a lasting token (' + (j.error || res.getResponseCode()) + '). The code lasts 10 minutes and works once: make a new one and run zohoConnect() again.');
  PROPS.setProperty('ZOHO_REFRESH', j.refresh_token);
  PROPS.deleteProperty('ZOHO_GRANT_CODE');
  if(j.access_token) CacheService.getScriptCache().put('ZOHO_ACCESS', j.access_token, 3000);
  var acc = zget_('/api/accounts').data || [];
  if(!acc.length) throw new Error('Zoho returned no mail account for this login.');
  PROPS.setProperty('ZOHO_ACCOUNT_ID', String(acc[0].accountId));
  Logger.log('Connected to Zoho mail: ' + (acc[0].primaryEmailAddress || acc[0].mailboxAddress || acc[0].accountId));
  ensureMailTrigger_();
  Logger.log(JSON.stringify(mailSync()));
}
function zohoToken_(){
  var cache = CacheService.getScriptCache(), t = cache.get('ZOHO_ACCESS');
  if(t) return t;
  var res = UrlFetchApp.fetch('https://accounts.zoho.' + PROPS.getProperty('ZOHO_DC') + '/oauth/v2/token', { method:'post', muteHttpExceptions:true,
    payload:{ refresh_token:PROPS.getProperty('ZOHO_REFRESH'), grant_type:'refresh_token',
              client_id:PROPS.getProperty('ZOHO_CLIENT_ID'), client_secret:PROPS.getProperty('ZOHO_CLIENT_SECRET') } });
  var j = JSON.parse(res.getContentText() || '{}');
  if(!j.access_token) throw new Error('Zoho refused the token refresh (' + (j.error || res.getResponseCode()) + '). Reconnect with zohoConnect().');
  cache.put('ZOHO_ACCESS', j.access_token, 3000);     // Zoho tokens last an hour
  return j.access_token;
}
function zget_(path){
  var res = UrlFetchApp.fetch('https://mail.zoho.' + PROPS.getProperty('ZOHO_DC') + path, { method:'get', muteHttpExceptions:true,
    headers:{ Authorization:'Zoho-oauthtoken ' + zohoToken_() } });
  var code = res.getResponseCode(), j;
  try { j = JSON.parse(res.getContentText() || '{}'); } catch(e){ j = {}; }
  if(code === 401){ CacheService.getScriptCache().remove('ZOHO_ACCESS'); }
  if(code >= 300) throw new Error('Zoho ' + code + ' on ' + path.split('?')[0] + ': ' + ((j.data && j.data.errorCode) || (j.status && j.status.description) || ''));
  return j;
}
function ensureMailTrigger_(){
  var has = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'mailSync'; });
  if(!has) ScriptApp.newTrigger('mailSync').timeBased().everyMinutes(15).create();
}
/* Turns the 15-minute mail sync off (filed mail stays). */
function mailSyncOff(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction() === 'mailSync') ScriptApp.deleteTrigger(t); });
  Logger.log('Mail sync is off.');
}

/* ------------------------------------------------------------------ mail sync */
function mailSync(){
  if(!PROPS.getProperty('ZOHO_REFRESH')) return { skipped:'Zoho is not connected yet' };
  var t0 = Date.now(), acct = PROPS.getProperty('ZOHO_ACCOUNT_ID');
  var clients = clientDomains_();
  if(!Object.keys(clients).length) return { skipped:'No client account in Orbit has a domain yet' };
  var known = {};
  var ssh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('sources');
  if(ssh) readTab_(ssh).rows.forEach(function(r){ if(r.external_id) known[r.external_id] = 1; });

  var folders = (zget_('/api/accounts/' + acct + '/folders').data || [])
    .filter(function(f){ return f.folderType === 'Inbox' || f.folderType === 'Sent'; });
  var out = { filed:0, seen:0, not_client:0, already:0, folders:{} };
  for(var i = 0; i < folders.length; i++){
    var f = folders[i], key = 'MAIL_MARK_' + f.folderId;
    var mark = +(PROPS.getProperty(key) || (Date.now() - FIRST_RUN_DAYS * 864e5));
    /* newest first, page back until we pass the watermark; then file oldest first */
    var fresh = [], start = 1, done = false;
    while(!done && Date.now() - t0 < MAIL_BUDGET_MS){
      var page = zget_('/api/accounts/' + acct + '/messages/view?folderId=' + f.folderId + '&start=' + start + '&limit=100&sortBy=date&sortorder=false').data || [];
      page.forEach(function(m){ if(+m.receivedTime > mark) fresh.push(m); else done = true; });
      if(page.length < 100) done = true;
      start += 100;
    }
    if(!done){ out.folders[f.folderType] = 'ran out of time while listing; the next run continues'; break; }
    fresh.sort(function(a, b){ return +a.receivedTime - +b.receivedTime; });
    var filed = 0;
    for(var k = 0; k < fresh.length; k++){
      if(Date.now() - t0 > MAIL_BUDGET_MS) break;             // the next run carries on from the watermark
      var m = fresh[k]; out.seen++;
      var ext = 'zoho:' + m.messageId, match = matchClient_(m, clients);
      if(known[ext]) out.already++;
      else if(!match) out.not_client++;
      else { fileMail_(acct, f, m, match, ext); known[ext] = 1; filed++; }
      PROPS.setProperty(key, String(m.receivedTime));
    }
    out.filed += filed; out.folders[f.folderType] = filed;
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  return out;
}
/* client domain → { account_id, project_id } (project = the account's only open project, else blank) */
function clientDomains_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var accts = readTab_(ss.getSheetByName('accounts')).rows, projs = readTab_(ss.getSheetByName('projects')).rows, map = {};
  accts.forEach(function(a){
    if(a.deleted || a.kind === 'vendor' || !a.domain) return;
    var open = projs.filter(function(p){ return !p.deleted && !p.archived && p.account_id === a.id && p.status !== 'Completed'; });
    String(a.domain).toLowerCase().split(/[,\s]+/).filter(Boolean).forEach(function(d){
      map[d.replace(/^@/, '')] = { account_id:a.id, account:a.name, project_id:open.length === 1 ? open[0].id : '' };
    });
  });
  return map;
}
function addresses_(s){
  s = unescape_(String(s || ''));
  var found = s.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  return found.map(function(x){ return x.toLowerCase(); });
}
function matchClient_(m, clients){
  var all = addresses_(m.fromAddress).concat(addresses_(m.toAddress), addresses_(m.ccAddress), addresses_(m.sender));
  for(var i = 0; i < all.length; i++){
    var dom = all[i].split('@')[1];
    while(dom){ if(clients[dom]) return clients[dom]; var dot = dom.indexOf('.'); dom = dot > -1 && dom.indexOf('.', dot + 1) > -1 ? dom.slice(dot + 1) : ''; }
  }
  return null;
}
function fileMail_(acct, folder, m, match, ext){
  var c = zget_('/api/accounts/' + acct + '/folders/' + folder.folderId + '/messages/' + m.messageId + '/content');
  var body = htmlToText_((c.data && c.data.content) || '');
  var when = new Date(+m.receivedTime).toISOString(), dir = folder.folderType === 'Sent' ? 'out' : 'in';
  var head = 'Subject: ' + unescape_(m.subject || '') + '\nFrom: ' + unescape_(m.fromAddress || m.sender || '') +
             '\nTo: ' + unescape_(m.toAddress || '') + (m.ccAddress ? '\nCc: ' + unescape_(m.ccAddress) : '') +
             '\nDate: ' + when + '\nZoho message: ' + m.messageId + '\n\n';
  var file = subFolder_(match.account).createFile((when.slice(0, 10) + ' email ' + dir + ' - ' + unescape_(m.subject || '')).slice(0, 180) + '.txt', head + body, 'text/plain');
  var t = new Date().toISOString(), people = addresses_(m.fromAddress).concat(addresses_(m.toAddress), addresses_(m.ccAddress));
  var row = { id:srcId_(), created_at:t, updated_at:t, deleted:false, kind:'email', project_id:match.project_id, account_id:match.account_id,
    occurred_at:when, direction:dir, from:unescape_(m.fromAddress || m.sender || '').slice(0, 300), to:unescape_(m.toAddress || '').slice(0, 1000),
    subject:unescape_(m.subject || '').slice(0, 500), people:people.filter(function(x, i){ return people.indexOf(x) === i; }).join(', ').slice(0, 2000),
    summary:unescape_(m.summary || '').slice(0, 1000), file_id:file.getId(), file_url:file.getUrl(), external_id:ext,
    thread_id:String(m.threadId || ''), size:(head + body).length, processed_at:'' };
  withLock_(function(){ saveRows_({ sources:[row] }, {}); });
}
function unescape_(s){
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function(_, n){ return String.fromCharCode(+n); }).replace(/&amp;/g, '&');
}
function htmlToText_(h){
  var s = String(h)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return unescape_(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
