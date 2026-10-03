/* =====================================================================
   My Day — the Day app, run unchanged in a same-origin frame so its CSS,
   ids and key handlers can't collide with Orbit's. It keeps its own storage
   (day.* keys) and its own Sheet sync. Orbit hands it a narrow bridge:
   what's due for me from projects, and three actions.
   ===================================================================== */
let dayFrame = null;
function mountDay(){
  if(dayFrame) return;
  const src = $("ln-day-src").textContent.replace(/<\\\/script/g, "</script").replace(/<\\!--/g, "<!--");
  dayFrame = h("iframe", { title:"My Day" });
  dayFrame.srcdoc = src;
  $("ln-dayhost").appendChild(dayFrame);
}
function dayRefresh(){ try{ if(dayFrame && dayFrame.contentWindow && dayFrame.contentWindow.dayRefresh) dayFrame.contentWindow.dayRefresh(); }catch(e){} }

window.OrbitDay = {
  /* Project tasks assigned to me for a given day: due that day, plus anything
     overdue when the day is today, plus what I completed that day. */
  items(date, today){
    const u = me();
    return rows("tasks", t => !t.parent_id && liveProject(t) && (t.assignee_ids || []).indexOf(u.id) > -1 && (
        (t.status !== "Completed" && t.due === date) ||
        (date === today && t.status !== "Completed" && t.due && t.due < today) ||
        (t.status === "Completed" && t.due_actual === date)))
      .sort(by(t => (t.status === "Completed" ? "1" : "0") + (t.due || "")))
      .map(t => ({ id:t.id, title:t.name, project:(byId("projects", t.project_id) || {}).name || "", status:t.status,
                   done:t.status === "Completed", milestone:t.type === "MILESTONE",
                   late:t.status !== "Completed" && t.due < date ? diffDays(t.due, date) : 0 }));
  },
  approvals(){
    const u = me();
    return rows("approvals", a => a.status === "REQUESTED" && (a.approver_ids || []).indexOf(u.id) > -1).map(a => {
      const t = byId("tasks", a.task_id) || {};
      return { id:a.id, task_id:t.id, title:t.name, project:(byId("projects", t.project_id) || {}).name || "", from:firstName(a.requested_by), late:a.due < todayISO() };
    });
  },
  complete(id, done){
    const t = byId("tasks", id); if(!t) return;
    setTaskStatus(t, done ? "Completed" : (t.start_actual ? "In progress" : "To do")); commit();
  },
  open(id){ const t = byId("tasks", id); if(t) location.hash = "#/projects/" + t.project_id + "/plan?t=" + t.id; },
  log(id, text, date){ const m = parseHours(text); if(!m) return ""; logTime(id, date || todayISO(), m, "", true); commit(); return fmtMins(m); }
};
