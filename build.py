#!/usr/bin/env python3
"""Assemble orbit.html — one self-contained file — from src/ and the vendored Day app.

    python3 build.py

Day (day/index.html, from github.com/Anandviswa/day) is embedded verbatim except
for three small, asserted patches that give it a "From projects" section and a
refresh hook. It runs in a same-origin srcdoc frame, so its CSS, ids and key
handlers never touch Orbit's.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
JS_ORDER = ["core.js", "seed.js", "ui.js", "project.js", "views.js", "portal.js", "daybridge.js", "app.js"]


def patch(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f"Day patch '{label}' expected 1 match, found {n} — has Day changed upstream?")
    return text.replace(old, new)


DAY_ORBIT_CSS = """
/* ---- Orbit bridge: "From projects" ---- */
.orbit .tk .proj{font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:2px;letter-spacing:.02em}
.orbit .tk .late{color:#9A3B3B}
.orbit .tk .go{background:none;border:0;color:var(--faint);cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;flex:none}
.orbit .tk .go:hover{color:var(--text)}
.orbit .tk .logt{width:74px;background:var(--surf);border:1px solid var(--edge);border-radius:8px;font-family:var(--mono);font-size:11px;padding:4px 6px;color:var(--text)}
.orbit .tk .ms{color:#7457A6;font-size:12px;margin-right:4px}
.orbit .appr .chk{border-color:var(--gold);background:var(--gold-soft)}
"""

DAY_ORBIT_JS = r"""
/* ============ Orbit bridge ============
   When Day runs inside Orbit, show the project work assigned to you for the
   day being viewed, and approvals waiting on you. Outside Orbit this is a no-op. */
var orbitLogOpen = null;
function orbitApi(){ try{ return (window.parent && window.parent !== window && window.parent.OrbitDay) || null; }catch(e){ return null; } }
function renderOrbit(){
  var L = orbitApi();
  [["orbitHome", today()], ["orbitToday", state.date]].forEach(function(b){
    var box = $(b[0]); if(!box) return;
    box.innerHTML = "";
    if(!L){ box.style.display = "none"; return; }
    var items = L.items(b[1], today()), aps = b[1] === today() ? L.approvals() : [];
    var open = items.filter(function(x){ return !x.done; }).length;
    box.className = "sec orbit";
    var head = el("div", "sec-head");
    head.appendChild(el("h2", null, "From projects"));
    head.appendChild(el("div", "rule"));
    head.appendChild(el("span", "meta", items.length ? open + " open" : ""));
    box.appendChild(head);
    var ul = el("ul", "tks");
    if(!items.length && !aps.length) ul.appendChild(el("li", "empty", b[1] === today() ? "Nothing due from projects today." : "Nothing due from projects this day."));
    aps.forEach(function(a){
      var li = el("li", "tk appr");
      var c = el("button", "chk"); c.title = "Open to approve"; c.addEventListener("click", function(){ L.open(a.task_id); });
      var tt = el("div", "tt");
      tt.appendChild(el("div", "tl", "Approve: " + a.title));
      tt.appendChild(el("div", "proj" + (a.late ? " late" : ""), a.project + " · asked by " + a.from + (a.late ? " · overdue" : "")));
      var go = el("button", "go", "Open ↗"); go.addEventListener("click", function(){ L.open(a.task_id); });
      li.appendChild(c); li.appendChild(tt); li.appendChild(go); ul.appendChild(li);
    });
    items.forEach(function(x){
      var li = el("li", "tk" + (x.done ? " done" : ""));
      var c = el("button", "chk"); c.innerHTML = tick();
      c.setAttribute("aria-label", (x.done ? "Reopen: " : "Complete: ") + x.title);
      c.addEventListener("click", function(){ L.complete(x.id, !x.done); renderOrbit(); });
      var tt = el("div", "tt");
      var tl = el("div", "tl"); if(x.milestone) tl.appendChild(el("span", "ms", "◆")); tl.appendChild(document.createTextNode(x.title)); tt.appendChild(tl);
      tt.appendChild(el("div", "proj" + (x.late ? " late" : ""), x.project + (x.late ? " · " + x.late + "d overdue" : "") + (x.status === "Blocked" ? " · blocked" : "")));
      li.appendChild(c); li.appendChild(tt);
      if(orbitLogOpen === x.id){
        var inp = el("input", "logt"); inp.placeholder = "1:30"; inp.title = "Hours — Enter to log";
        inp.addEventListener("keydown", function(e){
          if(e.key === "Enter"){ var r = L.log(x.id, inp.value, b[1]); orbitLogOpen = null; renderOrbit(); if(r) setStatus("ok", "Logged " + r + " on " + x.title); }
          if(e.key === "Escape"){ orbitLogOpen = null; renderOrbit(); }
        });
        li.appendChild(inp); setTimeout(function(){ inp.focus(); }, 0);
      } else if(!x.done){
        var lg = el("button", "go", "+ time"); lg.addEventListener("click", function(){ orbitLogOpen = x.id; renderOrbit(); });
        li.appendChild(lg);
      }
      var go = el("button", "go", "Open ↗"); go.addEventListener("click", function(){ L.open(x.id); });
      li.appendChild(go);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  });
}
window.dayRefresh = function(){ renderSoon(); };
"""


def build_day():
    day = (ROOT / "day" / "index.html").read_text()
    day = patch(day, "</style>\n</head>", DAY_ORBIT_CSS + "</style>\n</head>", "css")
    day = patch(day, '<div class="tiles" id="tiles"></div>',
                '<div class="tiles" id="tiles"></div>\n    <section class="sec" id="orbitHome"></section>', "home slot")
    day = patch(day, '    <section class="sec">\n      <div class="sec-head"><h2>Tasks</h2>',
                '    <section class="sec" id="orbitToday"></section>\n\n    <section class="sec">\n      <div class="sec-head"><h2>Tasks</h2>', "today slot")
    day = patch(day, "function renderAll(){\n  renderHeader(); renderRibbon();",
                "function renderAll(){\n  renderHeader(); renderRibbon(); renderOrbit();", "render hook")
    day = patch(day, "/* ============ boot ============ */", DAY_ORBIT_JS + "\n/* ============ boot ============ */", "bridge")
    # Embedded as raw text inside <script type="text/x-day">: only "</script" and "<!--" can end or
    # confuse that element, so escape both; daybridge.js reverses it before handing it to the frame.
    for bad in ("<\\/script", "<\\!--"):
        if bad in day:
            sys.exit(f"Day already contains {bad!r}; pick another escape")
    return day.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def main():
    css = (SRC / "orbit.css").read_text()
    shell = (SRC / "shell.html").read_text()
    js = "\n".join((SRC / f).read_text() for f in JS_ORDER)
    if "prefers-color-scheme" in css:
        sys.exit("orbit.css must stay light-only (no prefers-color-scheme)")
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Orbit</title>
<meta name="description" content="Client delivery platform — projects, plans, customer portal, timesheets, and My Day.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<!-- Built by build.py from src/ — edit the sources, not this file. -->
{shell}
<script type="text/x-day" id="ln-day-src">{build_day()}</script>
<script>
{js}
</script>
</body>
</html>
"""
    out = ROOT / "orbit.html"
    out.write_text(html)
    print(f"wrote {out} ({len(html)//1024} KB)")


if __name__ == "__main__":
    main()
