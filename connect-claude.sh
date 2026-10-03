#!/bin/zsh
# Connects Claude Code to your Orbit Sheet. Asks for the /exec URL and the
# orb_… secret (the secret is hidden while you paste it) and registers the
# orbit MCP server. Nothing is printed or saved anywhere else.
set -e
print "Orbit → Claude Code"
print "Paste the Web app URL (ends in /exec), then press Enter:"
read -r URL
print "Paste the secret (orb_…). It stays hidden. Press Enter:"
read -rs TOKEN
print
[[ "$URL" == https://script.google.com/*/exec ]] || { print "That URL doesn't end in /exec. Copy it from Deploy → Manage deployments and run this again."; exit 1; }
[[ "$TOKEN" == orb_* ]] || { print "The secret should start with orb_. In Apps Script run showSecret, then run this again."; exit 1; }
print "Checking the Sheet answers…"
if curl -sL --max-time 60 -H "Content-Type: text/plain" -d "{\"action\":\"ping\",\"token\":\"$TOKEN\"}" "$URL" | grep -q '"ok":true'; then
  print "  ✓ Orbit answered."
else
  print "  ✗ Orbit didn't accept that URL + secret. Check: deployment access is 'Anyone', and the secret matches showSecret."; exit 1
fi
claude mcp remove orbit --scope user >/dev/null 2>&1 || true
claude mcp add orbit --scope user -e "ORBIT_URL=$URL" -e "ORBIT_TOKEN=$TOKEN" -- node "$HOME/Documents/orbit/mcp/server.js" >/dev/null
unset URL TOKEN
print "  ✓ Claude Code is connected to Orbit. Go back to the chat and type: done"
