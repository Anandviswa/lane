// node server/test/local_server.mjs [port]
// Runs Code.gs (+ Mail.gs) on the in-memory mock behind a local HTTP server, and
// serves orbit.html, so the app and the MCP server can be tested end to end
// before the real Apps Script is deployed. Prints the test secret on start.
import http from "node:http";
import fs from "node:fs";
import { makeGas } from "./gas_mock.mjs";

const port = +(process.argv[2] || 8787);
const files = ["server/Code.gs"].concat(fs.existsSync("server/Mail.gs") ? ["server/Mail.gs"] : []);
const gas = makeGas({ files });
gas.ctx.setup();
console.log("Orbit test server on http://localhost:" + port + "  (exec URL: http://localhost:" + port + "/exec)");
console.log("TEST TOKEN " + gas.props.TOKEN);

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const cors = { "Access-Control-Allow-Origin": "*" };
  if(u.pathname === "/" || u.pathname === "/orbit.html"){
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(fs.readFileSync("orbit.html")); return;
  }
  if(u.pathname !== "/exec"){ res.writeHead(404); res.end(); return; }
  if(req.method === "GET"){
    const out = gas.ctx.doGet({ parameter: Object.fromEntries(u.searchParams) });
    res.writeHead(200, { "Content-Type": "application/json", ...cors }); res.end(out.getContent()); return;
  }
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    const out = gas.ctx.doPost({ postData: { contents: body } });
    res.writeHead(200, { "Content-Type": "application/json", ...cors }); res.end(out.getContent());
  });
}).listen(port);
