// node server/test/mail.test.mjs — Mail.gs against the mock, with a fake Zoho.
import assert from "node:assert/strict";
import { makeGas, call } from "./gas_mock.mjs";

const gas = makeGas({ files: ["server/Code.gs", "server/Mail.gs"] });
gas.ctx.setup();
const T = gas.props.TOKEN;
assert.ok(gas.props.SOURCES_FOLDER_ID, "setup makes the Drive folder");

// an ACM account + one open project, so mail routes to it
const t = new Date().toISOString();
call(gas, { token: T, action: "save", rows: {
  accounts: [{ id: "ac-acm", name: "AC Matthews", domain: "acmatthews.com", kind: "customer", created_at: t, updated_at: t, deleted: false }],
  projects: [{ id: "p-acm", name: "ACM M1", account_id: "ac-acm", status: "In progress", archived: false, created_at: t, updated_at: t, deleted: false }] } });

const now = Date.now(), H = 3600e3;
const inbox = [
  { messageId: "101", folderId: "1", fromAddress: "Matt &lt;matt@acmatthews.com&gt;", toAddress: "anand@fieldproxy.com", subject: "Optional skylights", receivedTime: String(now - 2 * H), summary: "Can skylights be optional?", threadId: "9" },
  { messageId: "102", folderId: "1", fromAddress: "news@vendor.com", toAddress: "anand@fieldproxy.com", subject: "Newsletter", receivedTime: String(now - 3 * H) },
  { messageId: "103", folderId: "1", fromAddress: "old@acmatthews.com", toAddress: "anand@fieldproxy.com", subject: "Too old", receivedTime: String(now - 9 * 24 * H) },
  { messageId: "104", folderId: "1", fromAddress: "anand@fieldproxy.com", toAddress: "arvin@mail.acmatthews.com", subject: "Re: Optional skylights", receivedTime: String(now - 1 * H + 5000) },
  { messageId: "105", folderId: "1", fromAddress: "marvin@acmatthews.com", toAddress: "group1@fieldproxy.com", subject: "Same mail", size: "333", receivedTime: String(now - 4 * H) },
  { messageId: "106", folderId: "1", fromAddress: "marvin@acmatthews.com", toAddress: "group2@fieldproxy.com", subject: "Same mail", size: "333", receivedTime: String(now - 4 * H + 2000) },
  { messageId: "107", folderId: "1", fromAddress: "marvin@acmatthews.com", toAddress: "anand@fieldproxy.com", subject: "Accepted: M1 Review Call 2", receivedTime: String(now - 5 * H) },
  { messageId: "108", folderId: "1", fromAddress: "tom@partner.example", toAddress: "anand@fieldproxy.com", subject: "Partner note", receivedTime: String(now - 6 * H) },
];
const sent = [{ messageId: "201", folderId: "2", fromAddress: "anand@fieldproxy.com", toAddress: "Arvin &lt;arvin@mail.acmatthews.com&gt;", subject: "Re: Optional skylights", receivedTime: String(now - 1 * H) }];
let refreshes = 0;
gas.ctx.__fetch = (url, opt) => {
  const R = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
  if(url.includes("/oauth/v2/token")){
    if(opt.payload.grant_type === "authorization_code") return R(200, { access_token: "at1", refresh_token: "rt1" });
    refreshes++; return R(200, { access_token: "at" + (refreshes + 1) });
  }
  assert.match(opt.headers.Authorization, /^Zoho-oauthtoken at/);
  if(url.endsWith("/api/accounts")) return R(200, { data: [{ accountId: "555", primaryEmailAddress: "anand@fieldproxy.com" }] });
  if(url.endsWith("/api/accounts/555")) return R(200, { data: { accountId: "555", primaryEmailAddress: "anand.v@fieldproxy.com", emailAddress: [{ mailId: "anand@fieldproxy.com" }, { mailId: "anand.v@fieldproxy.com" }] } });
  if(url.endsWith("/folders")) return R(200, { data: [{ folderId: "1", folderType: "Inbox" }, { folderId: "2", folderType: "Sent" }, { folderId: "3", folderType: "Trash" }] });
  if(url.includes("/messages/view")) return R(200, { data: url.includes("folderId=1") ? inbox : sent });
  const m = url.match(/messages\/(\d+)\/content/);
  if(m) return R(200, { data: { messageId: m[1], content: "<p>Hi Anand,</p><p>Can we make <b>skylights</b> optional?&nbsp;Thanks</p><style>x{}</style>" } });
  return R(404, {});
};

// not connected yet
assert.equal(call(gas, { token: T, action: "mail_sync_now" }).result.skipped, "Zoho is not connected yet");

Object.assign(gas.props, { ZOHO_DC: "in", ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "sec", ZOHO_GRANT_CODE: "code" });
gas.ctx.zohoConnect();
assert.equal(gas.props.ZOHO_REFRESH, "rt1"); assert.ok(!gas.props.ZOHO_GRANT_CODE, "grant code deleted");
assert.equal(gas.triggers.length, 1, "15-min trigger on");
assert.ok(gas.fetches.every(f => f.url.includes("zoho.in")), "uses the data centre");

let src = call(gas, { token: T, action: "all" }).rows.sources;
assert.equal(src.length, 3, "inbox + sent + one copy of the duplicate; newsletter, old, own copy, calendar skipped");
assert.equal(src.filter(s => s.subject === "Same mail").length, 1, "duplicate delivered twice filed once");
assert.ok(!src.some(s => /^Accepted/.test(s.subject)), "calendar reply skipped");
assert.ok(!src.some(s => s.direction === "in" && /anand@/.test(s.from)), "own inbox copy skipped");
const inMail = src.find(s => s.direction === "in" && s.subject === "Optional skylights"), outMail = src.find(s => s.direction === "out");
assert.equal(inMail.project_id, "p-acm"); assert.equal(inMail.subject, "Optional skylights");
assert.equal(outMail.account_id, "ac-acm", "subdomain mail.acmatthews.com matches");
assert.equal(inMail.external_id, "zoho:101");

const body = call(gas, { token: T, action: "source_get", id: inMail.id });
assert.match(body.text, /Can we make skylights optional\? Thanks/); assert.ok(!/<p>|x\{\}/.test(body.text));
assert.match(body.text, /^Subject: Optional skylights\nFrom: Matt <matt@acmatthews.com>/);

// re-run files nothing new
const again = call(gas, { token: T, action: "mail_sync_now" }).result;
assert.equal(again.filed, 0);
assert.equal(call(gas, { token: T, action: "all" }).rows.sources.length, 3);

// transcripts
const add = call(gas, { token: T, action: "source_add", kind: "transcript", project_id: "p-acm", account_id: "ac-acm", subject: "M1 review call 2", text: "x".repeat(60000) });
assert.ok(add.ok && add.file_url);
const tr = call(gas, { token: T, action: "source_get", id: add.id, offset: 59990, length: 100 });
assert.equal(tr.total, 60000); assert.equal(tr.text.length, 10);

// project rules: an exact address on another project wins over the account domain
call(gas, { token: T, action: "save", rows: {
  projects: [{ id: "p-acm2", name: "ACM Phase 2", account_id: "ac-acm", status: "In progress", archived: false, mail_match: ["tom@partner.example"], created_at: t, updated_at: t, deleted: false }] } });
gas.props.MAIL_MARK_1 = String(now - 7 * H);
const r2 = call(gas, { token: T, action: "mail_sync_now" }).result;
const tom = call(gas, { token: T, action: "all" }).rows.sources.find(s => s.subject === "Partner note");
assert.equal(tom && tom.project_id, "p-acm2", "address rule files partner mail into its project");

gas.ctx.mailSyncOff(); assert.equal(gas.triggers.length, 0);
console.log("Mail.gs: all tests passed");
