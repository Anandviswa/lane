/* =====================================================================
   Boot
   ===================================================================== */
(function boot(){
  db = loadDb();
  if(!db || !db.meta || !db.meta.seeded) seedDb();
  if(!session.user || !byId("users", session.user)){ session.user = "u-anand"; saveSession(); }
  window.addEventListener("hashchange", render);
  if(!location.hash || location.hash === "#" || location.hash === "#/") history.replaceState(null, "", "#/home");
  render();
  if(syncConfigured()) sync();
  window.addEventListener("online", sync);
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible"){ scheduleRender(); if(syncConfigured()) sync(); } });
  /* Another tab saved — pick it up. */
  window.addEventListener("storage", e => { if(e.key === LS_DB){ db = loadDb() || db; scheduleRender(); } });
  setInterval(() => { if(!typing()) scheduleRender(); }, 60000);
  /* Pick up what Claude and other devices wrote, while this tab is in view. */
  setInterval(() => { if(syncConfigured() && document.visibilityState === "visible" && !syncing) sync(); }, 45000);
})();
