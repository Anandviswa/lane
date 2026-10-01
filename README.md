# Lane

**A client delivery platform: plan projects, keep customers in the loop through their own
portal, and see your day across every project.**

Lane is for teams that implement things for customers: software rollouts, onboarding,
field-ops builds. Every customer project gets a plan, a health picture, a customer portal,
and a place to talk. Every person on the team gets one view of their day across all of it.

It is modelled on [Rocketlane](https://www.rocketlane.com). We took Rocketlane apart in a
trial account, kept the core, and rebuilt it. Right now it is a **single HTML file that
saves in your browser**. A Google Sheets backend through Apps Script is next (see
[ROADMAP.md](ROADMAP.md)).

---

## Try it

Open **`lane.html`** in Chrome. That's all there is to it.

Or serve the folder:

```bash
python3 -m http.server 8765
# → http://localhost:8765/lane.html
```

The first load fills Lane with a demo: **Stonebridge Roofing Group**, a 13-week field-ops and
estimating build with 7 overlapping phases, 55 tasks and 6 milestones. It is seeded partway
through, so there is real work to look at: three tasks overdue, one blocked, one approval
the customer is sitting on. The seed dates shift to today, so the demo always looks "live".

**Settings → Reset demo data** puts it back.

---

## What's in it

### For the delivery team

| Screen | What it does |
|---|---|
| **My Day** | Your personal daily page (routine, mood, journal, notes, personal tasks), plus a **From projects** section: the project work due today, anything overdue, and approvals waiting on you. Tick to complete, log time, or jump into the project. |
| **Home** | Your open tasks grouped by project, approvals waiting on you, hours this week, and the projects you own. |
| **Accounts** | Every customer, with their projects, contacts, fees and how they're doing. |
| **Projects** | Every project in flight, with progress and health chips (overdue, blocked, at risk). Filter by status and owner. |
| **New project wizard** | Basic info, then template(s), then team and customer. Templates can be stacked, and each role in a template is mapped to a real person. |
| **Project → Overview** | Tiles for completion, overdue, at risk, blocked, pending approvals and days left. Phase timeline with a today marker. Milestones show "Delayed by N days". Latest updates, the team, and project info (fee, ARR, budget) visible only to your team. |
| **Project → Plan** | A **board** with phases as columns and drag-and-drop between them, or a **Gantt** chart with day, week or month zoom, dependency arrows, a today line, and bars you can drag to move. |
| **Project → List** | An editable table grouped by phase. Change status, assignee and dates inline. Filters: Open, Mine, Overdue, At risk, Blocked. |
| **Task drawer** | Status, assignees, dates, effort, at-risk and private flags, rich description, subtasks, dependencies (waiting on / blocking), approvals, a conversation, and an activity history. |
| **Project → Chat** | A *General* thread the customer can see, a *Private* team thread, and a conversation on each task. `@` mentions a person; `@@` links a task and starts a conversation on it. One toggle makes a single message private. |
| **Project → Files** | Links, and documents with **SmartFill** fields (`{{project.due}}`, `{{project.progress}}`…) that fill in from live project data. |
| **Project → Updates** | Status posts for the customer, or internal-only ones. "Insert project summary" writes the progress line for you. |
| **Templates** | Save any project as a template: its dates become day offsets and its people become roles. Edit phases, tasks, offsets, durations, roles and dependencies. |
| **Timesheets** | A weekly grid. Submit the week, withdraw it, and project owners approve or reject. |

### For the customer

**Customer portal** (`View as customer` / `Customer view`) is a separate screen, not a filtered
copy of the internal app:

- **Home:** a welcome message, progress, status, go-live date, next milestone, and what's
  waiting on them.
- **Plan:** shared phases and tasks only. They can update tasks assigned to them.
- **Files, Updates, Chat:** only what was shared. Which tabs the customer sees is set per
  project.
- **Action items:** approvals for them (approve, then confirm, recorded under their name) and
  their open tasks.

Anything marked **private** never reaches the portal: a private phase hides every task in it,
and private tasks, files, messages, internal updates and internal approvals are filtered out
too. All of that goes through one function, `visibleTo()`.

---

## The rules it enforces

- **Dependencies:** a task that waits on another starts the day after its latest blocker
  ends, keeping its duration. Only linked tasks move, and dates only move later; removing a
  link leaves dates where they landed. A link that would create a loop is refused.
- **Phases** stretch to contain their tasks; a phase's status follows its tasks.
- **Actual dates** are stamped when work starts and finishes, and can't be backdated.
- **At risk** is a judgement a person makes, never inferred. **Running late** means the
  project has overdue tasks.
- **Approvals** are requested with approvers, a due date and a note. Shared ones show up in
  the customer's Action items; internal ones never do.
- **Timesheets** go Not submitted → Submitted → Approved / Rejected. A submitted week is
  locked until it's withdrawn.

---

## My Day = the Day app

My Day is [Day](https://github.com/Anandviswa/day), the personal daily-page app, running
**unchanged** inside Lane:

- It runs in a same-origin frame, so its styles and keyboard shortcuts can't clash with
  Lane's.
- It keeps **its own storage and its own Google Sheet sync**, so existing Day data and setup
  keep working.
- `build.py` adds three small, checked patches: a *From projects* section on Day's Home and
  Today screens, and a refresh hook. The patches use a narrow bridge, `window.LaneDay`, with
  `items`, `approvals`, `complete`, `open` and `log`.

To pick up a newer Day, copy its `index.html` into `day/` and rebuild. If a patch no longer
matches, the build stops instead of shipping something half-patched.

---

## How it's built

```
lane.html          ← the app. Generated — don't edit by hand.
build.py           ← assembles lane.html from src/ + day/
src/
  lane.css         styles (light theme; Day's type and palette)
  shell.html       app frame: rail, top bar, drawer, modal hosts
  core.js          helpers, record store, sync, visibility, plan rules
  seed.js          Stonebridge demo data
  ui.js            element helper, icons, components, router, render loop
  project.js       project tabs + task drawer
  views.js         home, accounts, projects, wizard, tasks, templates, timesheets, settings
  portal.js        customer portal
  daybridge.js     mounts Day, exposes window.LaneDay
  app.js           boot
day/index.html     Day, vendored from github.com/Anandviswa/day
```

To change something, edit `src/` and run `python3 build.py`. The stack is plain JavaScript:
no framework, no npm, no build tools beyond that one Python script. Fonts come from Google
Fonts.

**Data.** Every record is a flat row with `id`, `created_at`, `updated_at` and `deleted`
(deletes are tombstones). Rows sit in 14 collections: accounts, users, projects, phases,
tasks, deps, approvals, messages, files, updates, templates, time_entries, activity and
notifications. Each collection maps one-to-one to a Google Sheet tab in Phase 2. The browser
half of sync is already written (Day's proven pattern: a dirty queue, a push guarded against
mid-flight edits, a pull that keeps whichever copy is newer, with unsynced local edits
winning). It stays off until a server URL is set in Settings. The column list for every tab
and the request formats are in [ROADMAP.md](ROADMAP.md#phase-2--google-sheets-backend).

---

## Limits today

- **No real login.** The avatar menu switches who you're acting as, and "View as customer"
  previews the portal. The customer-privacy rules are enforced in the browser only, which is
  fine for a demo and not fine for real customers. Fixing that is Phase 3.
- **Data lives in one browser** until Phase 2. Use **Settings → Export / Import JSON** to
  move it between browsers.
- **Not built yet:** resource management, financials, the automation builder, forms and
  reports. See the roadmap.

---

## Where it came from

The design comes from a hands-on teardown of Rocketlane: its public API spec plus a trial
account worked through a full 13-week implementation. The pieces kept are the ones that
carry the product:
- the project → phase → task spine
- dependency-driven dates
- the three-sided project (your team, the customer, partners)
- private vs shared at every level
- templates that turn dates into offsets and people into roles
- a customer portal that's its own experience
