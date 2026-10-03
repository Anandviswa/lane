// node test/call.mjs <tool> '<json args>'  — calls one Orbit MCP tool exactly the way
// Claude Code does (stdio), using the orbit server config from ~/.claude.json.
// Never prints the URL or the secret.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8")).mcpServers.orbit;
const t = new StdioClientTransport({ command: cfg.command, args: cfg.args, env: { ...process.env, ...cfg.env } });
const c = new Client({ name: "orbit-call", version: "0" });
await c.connect(t);
const r = await c.callTool({ name: process.argv[2], arguments: JSON.parse(process.argv[3] || "{}") });
console.log((r.isError ? "ERROR " : "") + r.content.map(x => x.text).join("\n"));
await c.close();
