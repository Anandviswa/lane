#!/usr/bin/env node
// Orbit MCP server: gives Claude Code tools to read and write Orbit.
// Config comes only from the environment (set by `claude mcp add … -e`):
//   ORBIT_URL    the Apps Script web app /exec URL
//   ORBIT_TOKEN  the secret setup() printed
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as T from "./lib/tools.js";
import { configured } from "./lib/client.js";

const server = new McpServer({ name: "orbit", version: "0.1.0" });

const ok = data => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
const fail = e => ({ isError: true, content: [{ type: "text", text: "Orbit: " + (e && e.message || e) }] });
function tool(name, description, inputSchema, fn, annotations = {}){
  server.registerTool(name, { description, inputSchema, annotations }, async args => {
    try { return ok(await fn(args || {})); } catch(e){ return fail(e); }
  });
}
const RO = { readOnlyHint: true };
const projectArg = z.string().describe("Project id (p…) or its name; a unique part of the name works");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd");

/* ---------------- reads ---------------- */
tool("orbit_today",
  "What's on Anand's plate today across every Orbit project: tasks due or overdue, tasks in progress, tasks queued for Claude, approvals waiting on Anand, and unprocessed mail/transcripts. Call this at the start of work to know what's pending.",
  {}, () => T.today(), RO);

tool("orbit_list_projects",
  "Every Orbit project with its account, dates, progress %, health and counts of open/overdue/blocked tasks and pending approvals.",
  { include_archived: z.boolean().optional() }, a => T.listProjects(a), RO);

tool("orbit_get_project",
  "One project in full: phases with their tasks (ids, status, dates, who, agent brief, dependencies), open approvals, decisions, latest updates, files, recent activity and recent mail/transcripts. Use before planning or working on a client.",
  { project: projectArg }, a => T.getProject(a), RO);

tool("orbit_query",
  "Read-only filtered slice of any Orbit collection for analysis (accounts, users, projects, phases, tasks, deps, approvals, messages, files, updates, templates, time_entries, activity, notifications, decisions, agent_runs, sources). Filters combine. For large analyses use orbit_export instead.",
  { collection: z.string(), project: projectArg.optional(), status: z.string().optional(), doer: z.enum(["anand", "claude"]).optional(),
    since: z.string().optional().describe("ISO date/time; compared with at/date/due/occurred_at/updated_at"), until: z.string().optional(),
    where: z.record(z.string(), z.any()).optional().describe("Exact field matches, e.g. {\"kind\":\"promise\"}"),
    fields: z.array(z.string()).optional(), limit: z.number().int().min(1).max(2000).optional(), include_deleted: z.boolean().optional() },
  a => T.query(a), RO);

tool("orbit_export",
  "Write every Orbit collection (or one project's records) as JSON files to ~/orbit-export/<timestamp>/ for analysis with a script. Returns the folder and counts.",
  { project: projectArg.optional() }, a => T.exportAll(a), RO);

/* ---------------- writes ---------------- */
tool("orbit_create_project",
  "Create a client project (and its account if new). Set the account domain, e.g. acmatthews.com, so the client's email files into this project automatically.",
  { name: z.string(), account: z.string().describe("Client company name"), domain: z.string().optional(),
    start: date.optional(), due: date.optional(), status: z.enum(["Proposed", "In progress", "On hold", "Blocked", "Completed"]).optional(),
    welcome: z.string().optional().describe("Customer portal welcome line") },
  a => T.createProject(a));

const planTask = z.object({
  key: z.string().optional().describe("Your own short key, used to wire dependencies inside this call"),
  name: z.string(), description: z.string().optional(),
  type: z.enum(["TASK", "MILESTONE"]).optional(), status: z.enum(["To do", "In progress", "Blocked", "Completed"]).optional(),
  start: date.optional(), due: date.optional(), duration_days: z.number().int().min(0).optional(),
  assignee: z.string().optional().describe("anand | claude | a person's name"),
  doer: z.enum(["anand", "claude"]).optional().describe("Who does the work. claude = an agent can pick it up"),
  kind: z.enum(["build", "test", "fix", "push", "client_call", "planning", "review", "design", "data", "promise", "from_client", "other"]).optional(),
  autonomy: z.enum(["draft", "do", "do_then_ask"]).optional().describe("How far an agent may go. Pushes, schema changes and client messages always need do_then_ask"),
  agent_brief: z.string().optional().describe("For doer=claude: goal, context links, checks that must pass, limits, time budget"),
  app_ref: z.string().optional().describe("App this touches, e.g. acm_settings (one agent per app at a time)"),
  source_ref: z.string().optional().describe("Where this came from, e.g. 'M1 review call 2, 17:08' or a source id"),
  priority: z.string().optional(), at_risk: z.boolean().optional(), private: z.boolean().optional(), effort_hours: z.number().optional(),
});
tool("orbit_create_plan",
  "Add phases and tasks to a project in one go (new phases are created; a phase with an existing name is appended to). Dependencies use your task keys or existing task ids: a task starts the day after its latest blocker and keeps its duration; loops are refused. This is how a plan made with Claude lands in Orbit.",
  { project: projectArg,
    phases: z.array(z.object({ name: z.string(), private: z.boolean().optional(), tasks: z.array(planTask) })),
    deps: z.array(z.object({ task: z.string(), waits_on: z.string() })).optional() },
  a => T.createPlan(a));

tool("orbit_update_task",
  "Change a task: status (To do / In progress / Blocked / Completed — actual dates are stamped automatically), dates (dependent tasks move), name, description, assignee, doer, kind, autonomy, agent brief, app, session link, and/or add a progress note to the task's conversation. Use after any work on a task.",
  { task: z.string().describe("Task id"), status: z.enum(["To do", "In progress", "Blocked", "Completed"]).optional(),
    name: z.string().optional(), description: z.string().optional(), start: date.optional(), due: date.optional(), at_risk: z.boolean().optional(),
    assignee: z.string().optional(), doer: z.enum(["anand", "claude"]).optional(), kind: z.string().optional(),
    autonomy: z.enum(["draft", "do", "do_then_ask"]).optional(), agent_brief: z.string().optional(), app_ref: z.string().optional(),
    session_ref: z.string().optional(), note: z.string().optional().describe("Progress note: what was done, evidence links, what's left") },
  a => T.updateTask(a));

tool("orbit_request_approval",
  "Stop and ask Anand (or a customer, with shared=true) to approve something on a task: a push to a live app, a schema change, a client message. Shows in Orbit and My Day as waiting on them. Then stop work on that step; check later with orbit_approval_status.",
  { task: z.string(), note: z.string().describe("What exactly will happen if approved, and where the evidence is"), due: date.optional(),
    approver: z.string().optional().describe("Default anand"), shared: z.boolean().optional().describe("true = a customer approval shown in their portal") },
  a => T.requestApproval(a));

tool("orbit_approval_status", "Whether an approval was approved, rejected or is still waiting.",
  { approval: z.string() }, a => T.approvalStatus(a), RO);

tool("orbit_post_update",
  "Post a project status update. private=true (default) is internal; private=false is shown to the customer in their portal — only post those after Anand has approved the wording.",
  { project: projectArg, body: z.string(), private: z.boolean().optional() }, a => T.postUpdate(a));

tool("orbit_attach",
  "Attach a link (artifact, report, diff, PR, screenshot folder, Claude session) to a project, optionally noted on a task.",
  { project: projectArg, name: z.string(), url: z.string().optional(), kind: z.string().optional(), task: z.string().optional(), body: z.string().optional() },
  a => T.attach(a));

tool("orbit_log_decision",
  "Record a decision on a project with its source, e.g. text 'Fields are hard-coded for ACM in M1', decided_by 'Matt + Anand', source 'Email 8 Sep' or a source id, source_ref '17:08'.",
  { project: projectArg, text: z.string(), decided_by: z.string().optional(), at: z.string().optional(), source: z.string().optional(), source_ref: z.string().optional() },
  a => T.logDecision(a));

tool("orbit_log_run",
  "Record one agent run on a task (for analysis of how the agents do): agent name, outcome done|waiting_on_you|blocked|failed, and a short note.",
  { task: z.string().optional(), agent: z.string(), outcome: z.enum(["done", "waiting_on_you", "blocked", "failed"]), note: z.string().optional(),
    started_at: z.string().optional(), ended_at: z.string().optional(), session_ref: z.string().optional() },
  a => T.logRun(a));

/* ---------------- mail, transcripts, notes ---------------- */
tool("orbit_sources",
  "List or search filed emails, call transcripts and notes (newest first): by project, words in subject/summary/people, date, or only unprocessed ones. Returns records and summaries, not full text.",
  { project: projectArg.optional(), unprocessed: z.boolean().optional(), words: z.string().optional(), since: z.string().optional(), limit: z.number().int().optional() },
  a => T.sources(a), RO);

tool("orbit_get_source",
  "The full text of one email, transcript or note (or a slice: offset + length characters). Quote from it with its source id when answering.",
  { source: z.string(), offset: z.number().int().min(0).optional(), length: z.number().int().min(1).max(100000).optional() },
  a => T.getSource(a), RO);

tool("orbit_add_source",
  "File a call transcript or a note into Orbit (stored as a Drive file + a sources row). Pass file_path to a local .txt/.vtt/.md file, or text.",
  { kind: z.enum(["transcript", "note", "email"]).optional(), project: projectArg.optional(), file_path: z.string().optional(), text: z.string().optional(),
    subject: z.string().optional(), occurred_at: z.string().optional(), people: z.string().optional() },
  a => T.addSource(a));

tool("orbit_source_done",
  "Mark an email/transcript as processed after its decisions, promises and requests were accepted by Anand and written. Optionally store a summary and set its project.",
  { source: z.string(), summary: z.string().optional(), project: projectArg.optional() },
  a => T.sourceDone(a));

tool("orbit_mail_sync_now",
  "Pull new client mail from Zoho into Orbit right now instead of waiting for the 15-minute run. Returns how many were filed.",
  {}, () => T.mailSyncNow());

if(!configured()) console.error("orbit-mcp: ORBIT_URL / ORBIT_TOKEN not set — tools will return a setup error.");
await server.connect(new StdioServerTransport());
