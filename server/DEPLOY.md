# Setting up Orbit's backend

About 20 minutes, once. Everything happens in your own Google account
(anand@fieldproxy.com). No one else needs access to anything.

You'll end up with:
- a Google Sheet called **Orbit** (your data, one tab per kind of record)
- a web address ending in **/exec** (the API the app and Claude talk to)
- a **secret** starting `orb_` (proves a request is yours)

Keep the secret private. Anyone with the address and the secret can read and change Orbit.

---

## Part 1 · The Sheet and the API (≈10 min)

1. Go to **sheets.new**. Name the sheet **Orbit**.
2. **Extensions → Apps Script.** A code editor opens in a new tab.
3. Name the project **Orbit** (click "Untitled project" at the top).
4. The editor has a file called `Code.gs`. Delete everything in it, then paste the whole
   of `server/Code.gs` from this repo. Press **Save** (the disk icon, or ⌘S).
5. Click **+** next to *Files* → **Script** → name it `Mail` (it becomes `Mail.gs`).
   Paste the whole of `server/Mail.gs`. Save.
6. In the function picker at the top (next to *Debug*), choose **setup** → **Run**.
   - Google asks for permission: **Review permissions** → pick your account → **Allow**.
     It asks for Sheets (to store the data), Drive (to keep email and transcript files in an
     "Orbit Sources" folder), external requests (to read Zoho mail) and triggers (the
     15-minute mail sync).
   - The log at the bottom ends with your **secret** (`orb_…`). Copy it somewhere safe.
     Lost it? Run **showSecret**.
7. Choose **selfTest** → **Run**. Every line should say **PASS** and the last line
   **All checks passed.** If anything says FAIL, stop and send the log to Claude.
8. **Deploy → New deployment.** Click the gear → **Web app**.

   | Setting | Choose |
   |---|---|
   | Description | Orbit |
   | Execute as | **Me (anand@fieldproxy.com)** |
   | Who has access | **Anyone** |

   ⚠️ **"Anyone", not "Anyone with a Google account".** The second one puts a Google login
   in front of every request and every save fails silently. "Anyone" only means anyone who
   has the address — and every request must also carry the secret.

9. **Deploy** → copy the **Web app URL** (it ends in `/exec`).

**Changing the code later:** paste the new code, save, then **Deploy → Manage deployments
→ pencil → Version: New version → Deploy.** The address stays the same. Saving alone
changes nothing that's live.

---

## Part 2 · Connect the app (≈3 min, on each device)

1. Open **https://anandviswa.github.io/orbit/** (Mac, then phone).
2. **Settings → Google Sheets sync.** Paste the /exec address and the secret → **Connect**.
3. Confirm. That device's demo data is cleared and everything loads from your Sheet.
   The status line shows **Synced hh:mm**.

On the phone: Safari → Share → **Add to Home Screen** to open Orbit like an app.

---

## Part 3 · Connect Claude Code (≈2 min)

In a terminal on your Mac (paste your own address and secret):

```
claude mcp add orbit --scope user \
  -e ORBIT_URL=https://script.google.com/macros/s/…/exec \
  -e ORBIT_TOKEN=orb_… \
  -- node /Users/anandviswanathan/Documents/orbit/mcp/server.js
```

Then start a new Claude session. `claude mcp list` should show **orbit ✓ connected**, and
asking Claude "what's on my plate in Orbit today?" uses `orbit_today`.

---

## Part 4 · Zoho mail (≈10 min)

Orbit reads your Zoho mail (read-only) and files mail to or from a client domain into that
client's project. It never sends, moves or marks mail. Only accounts in Orbit with a
**domain** set (e.g. `acmatthews.com`) are matched.

1. Note your Zoho data centre from the address bar when you're signed in to Zoho Mail:
   `mail.zoho.com` → **com**, `mail.zoho.in` → **in**, `mail.zoho.eu` → **eu**.
2. Open **api-console.zoho.com** (or `.in` / `.eu` to match) → **Add Client** →
   **Self Client** → **Create** → OK.
3. In the Self Client, tab **Generate Code**:
   - Scope: `ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ`
   - Time duration: **10 minutes**
   - Description: Orbit → **Create** → copy the code. It works once, for 10 minutes.
4. Tab **Client Secret**: copy the **Client ID** and **Client Secret**.
5. Back in Apps Script: ⚙ **Project Settings** → **Script properties** → **Add script
   property**, four times:

   | Property | Value |
   |---|---|
   | `ZOHO_DC` | `com`, `in` or `eu` (from step 1) |
   | `ZOHO_CLIENT_ID` | the Client ID |
   | `ZOHO_CLIENT_SECRET` | the Client Secret |
   | `ZOHO_GRANT_CODE` | the code from step 3 |

   **Save script properties.**
6. Editor → function picker → **zohoConnect** → **Run**. The log says which mailbox
   connected, then how many emails it filed from the last 7 days. The grant code is deleted
   automatically; the lasting token stays in Script properties.
7. **Deploy → Manage deployments → pencil → New version → Deploy** (once, so the app and
   Claude can call the mail actions).

From then on mail is checked every 15 minutes. Apps Script → **Executions** shows each
run. To stop it, run **mailSyncOff**.

If a run says Zoho refused the token, repeat steps 3, 5 (only `ZOHO_GRANT_CODE`) and 6.

---

## If something's wrong

| You see | Means | Fix |
|---|---|---|
| App: "Secret doesn't match" | Wrong or old secret | Run **showSecret**, paste it again |
| App: "Can't reach that URL" | Address wrong, or offline | Copy the /exec URL again from Manage deployments |
| App: "URL isn't the /exec one" | You pasted the editor or /dev address | Use the Web app URL ending in /exec |
| Saves don't appear | Access set to "Anyone with a Google account" | Manage deployments → pencil → Who has access: **Anyone** → New version |
| Code change has no effect | Saved but not redeployed | Manage deployments → New version |
| Claude: "ORBIT_TOKEN doesn't match" | Secret in the `claude mcp add` command is wrong | `claude mcp remove orbit`, add it again |

To make a new secret: run **rotateSecret**, then update every device and the Claude command.
