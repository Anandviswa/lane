# Orbit — what's next

Phase 1 (this repo today) is a working single-file prototype that saves in the browser.
This file lists what comes after it, in the order it should be done.

| Phase | Goal | Status |
|---|---|---|
| 1 | HTML prototype: core delivery and My Day | ✅ Done |
| 2 | Google Sheets backend through Apps Script, plus Claude Code tools (MCP) and Zoho mail | ✅ Built — see server/DEPLOY.md |
| 3 | Real users: login, server-side privacy, customer access | Planned |
| 4 | Resourcing, money, automations, forms, reports | Planned |
| — | Quality work that runs alongside the phases | Ongoing |

---

## Phase 2 — Google Sheets backend

**Goal:** the same app, with data in a Google Sheet so it survives across browsers, devices
and people.

The browser half is already written and tested in `src/core.js` (`markDirty`, `sync`,
`pull`), using the pattern Day has proven in daily use. What's missing is the server.

### To do

- [ ] **Write a generic `Code.gs`** (one file, same shape as the AC Matthews question-channel
  script):
  - `doPost`: parse `{token, action:"save", rows:{<tab>:[record,…]}}`, check the token,
    take `LockService.getScriptLock()`, then **upsert each record by `id`**, finding columns
    by header name. Append a column when a record brings a new field. Reply
    `{ok:true}`.
  - `doGet?action=all&token=…&since=<iso>`: return `{ok:true, now, rows:{<tab>:[…]}}` with
    every row whose `updated_at > since`, deleted rows included, so deletes travel.
  - Write arrays and objects as JSON text in one cell, and parse them back on read.
  - `setup()`: create the 14 tabs with their header rows.
- [ ] **Deploy:** Web app, *Execute as: Me*, *Who has access: Anyone*. Paste the `/exec` URL
  and the shared secret into **Settings → Google Sheets sync**.
  - ⚠️ Every code change needs **Manage deployments → Edit → New version**. Saving the
    script alone does nothing to the live URL.
  - ⚠️ "Anyone with a Google account" puts a login wall in front of the browser's requests,
    and saves fail silently.
- [ ] **Do a first push of the demo data** and check that every tab fills.
- [ ] **Two-browser test:** edit in browser A and see it appear in browser B after a pull.
  Edit the same task in both while one is offline, and check that the newer
  `updated_at` wins and nothing is lost.
- [ ] **Pull on a timer** (every 30–60 s while the tab is visible), not only on focus.
- [ ] **Check the limits:** Apps Script has a 6-minute execution cap and Sheets has a
  10-million-cell ceiling. Measure a push of ~5k rows. If it's slow, batch writes with
  `setValues` per tab instead of row by row.
- [ ] **Archive old activity and notifications** into a separate sheet once they pass a few
  thousand rows.

### Sheet tabs (one per collection)

Every tab has `id, created_at, updated_at, deleted` plus:

| Tab | Columns |
|---|---|
| accounts | name, domain, industry, logo_color, kind |
| users | name, email, type (TEAM / CUSTOMER), role, account_id, capacity_min, status |
| projects | name, account_id, owner_id, status, start, due, start_actual, due_actual, team_ids, customer_ids, visibility, portal_tabs, portal_welcome, fields, template_id, archived |
| phases | project_id, name, order, start, due, status, private |
| tasks | project_id, phase_id, parent_id, name, description, type, status, priority, at_risk, start, due, start_actual, due_actual, assignee_ids, follower_ids, effort_min, private, csat_enabled |
| deps | project_id, task_id, blocked_by_id |
| approvals | project_id, task_id, approver_ids, requested_by, due, status, type, note, responded_by, responded_at |
| messages | project_id, thread (`general` / `private` / `task:<id>`), author_id, body, private, mentions, at |
| files | project_id, name, kind (doc / link), url, body, private, author_id, at |
| updates | project_id, author_id, body, private, at |
| templates | name, category, description, phases, deps, source_project_id |
| time_entries | user_id, project_id, task_id, date, minutes, billable, notes, status, submitted_at, reviewed_by, reviewed_at |
| activity | project_id, task_id, user_id, text, at |
| notifications | user_id, text, link, read, at |

My Day's data stays in Day's own Sheet, through Day's own script. Phase 2 doesn't touch it.

---

## Phase 3 — Real users and real customers

**Goal:** people sign in as themselves, and a customer can only ever receive their own
shared data.

Today the privacy rules (`visibleTo()`) run **in the browser**. Once the data is in a Sheet,
anyone holding the token can read everything. So, before any real customer uses it:

- [ ] **Sign-in for the team.** The simplest option is Google Sign-In, deploying the script
  as *Execute as: User accessing*, or verifying a Google ID token in `doPost`/`doGet`.
- [ ] **Sign-in for customers:** a magic link by email (a one-time token stored in a
  `sessions` tab). Customers shouldn't need Google accounts.
- [ ] **Enforce privacy on the server:** `doGet` returns only the rows that user may see.
  Port `visibleTo()` into `Code.gs` and have the server apply it to customer requests; the
  browser copy stays as a second line of defence.
- [ ] **Give customers a portal URL**, e.g. `orbit.html#/portal/<project>`, that opens
  straight into their portal with no internal app behind it.
- [ ] **Roles and permissions:** at least Admin, Project owner, Member and Customer. Decide
  what a customer may edit; today they can change the status of their own tasks and approve.
- [ ] **Invite flow:** "Invite customer contact" sends the magic-link email (MailApp).
- [ ] **Email notifications** for mentions, assignments and approvals, with a daily digest
  option (the question-channel "sweep" pattern).
- [ ] **Audit trail:** the activity log is already written; make it read-only and
  exportable.

---

## Phase 4 — Resourcing, money, automations, forms, reports

These were left out of the first version on purpose.

- [ ] **Resource management:**
  - allocations per person per week
  - role placeholders, swapped for real people later
  - a utilisation strip with the >100% / 81–100 / … bands
  - soft vs hard bookings
  - "find availability"
- [ ] **Financials:**
  - a budget per project (fixed fee / time & material / subscription)
  - rate cards with bill rates per role and cost rates per person
  - forecast vs actual revenue, cost and margin
  - estimate-at-completion
- [ ] **Automations** (trigger → condition → action rules):
  - triggers: task status changed, due date moved, overdue, approval answered, phase
    completed
  - actions: notify, assign the owner, mark at risk, postpone, request approval, import a
    template
  - starter playbooks: *Blocked → notify owner*, *Due date slipped → mark at risk*, *Phase
    done → import the next template*
  - also: an "approval overdue" trigger.
- [ ] **Forms:** kick-off and hand-off forms attached to a phase. On submit, write project
  fields and create a task holding every answer.
- [ ] **Reports:**
  - an operations view: started on time %, completed on time %, average delay, all by
    template
  - portfolio: revenue, cost and margin across projects
  - utilisation
- [ ] **Key events and intervals:** account-level milestones with planned vs actual dates.
- [ ] **CSAT:** a rating request on chosen tasks, with low scores notifying the owner.
- [ ] **Custom fields** per object (text, number, date, choice, person), managed in
  Settings.
- [ ] **Partners:** a third side on a project (delivery partners with their own view).

---

## Quality work (ongoing)

### Tests and safety

- [ ] **Tests for the plan rules:** dependency shifting, loop guard, phase bounds, template
  offsets and visibility. `core.js` is plain functions, so run them under Node with a tiny
  harness.
- [ ] **A boot check in CI:** load `orbit.html` in a headless browser, visit every route, and
  fail on any console error.
- [ ] **Undo** for deletes and drag moves (a toast with "Undo").

### Plan and editing

- [ ] **Gantt:** drag a bar's end to change its duration, and draw dependencies by dragging
  from one bar to another.
- [ ] **Board:** reorder cards within a column, and filter by phase status.
- [ ] **File uploads** to Google Drive (the question-channel image path already does this),
  instead of links only.

### Performance

- [ ] Index records by id: `byId` is a linear scan, which is fine for hundreds of rows but
  not tens of thousands.
- [ ] Re-render only the changed region instead of the whole screen.

### Polish

- [ ] **Accessibility pass:** keyboard drag-and-drop alternatives, focus order in the
  drawer, and contrast on the faint text.
- [ ] **Phone layout:** the board and Gantt work but are cramped; add a list-first mobile
  plan view.
- [ ] **Time zones:** dates are local calendar dates today; decide on a team time zone
  setting (Day already has one).

### My Day

- [ ] Make Day's personal defaults configurable (name, routines, food list) so a teammate
  starts from a clean page.
- [ ] Optionally show today's project tasks on Day's day-grid calendar view.

---

## Repo housekeeping

- [ ] Turn on GitHub Pages for this repo so `orbit.html` opens from a link. While all the data
  stays in each viewer's browser, this is safe to share.
- [ ] Add a `LICENSE` once it's decided whether the repo stays private.
