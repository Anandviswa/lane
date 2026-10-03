// Connects to server.js the way Claude Code does (stdio), lists tools, calls orbit_today.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const t = new StdioClientTransport({ command: "node", args: ["server.js"], env: { ...process.env } });
const c = new Client({ name: "handshake", version: "0" });
await c.connect(t);
const { tools } = await c.listTools();
console.log(tools.length + " tools:", tools.map(x => x.name).join(", "));
const r = await c.callTool({ name: "orbit_today", arguments: {} });
console.log("orbit_today →", r.isError ? "ERROR " : "", r.content[0].text.slice(0, 160).replace(/\n/g, " "));
await c.close();
