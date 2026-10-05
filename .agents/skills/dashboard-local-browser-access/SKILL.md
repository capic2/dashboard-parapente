---
name: dashboard-local-browser-access
description: Use when opening, inspecting, or interacting with the dashboard-parapente frontend in a local or SSH Codex session, including starting the app and signing in with Bitwarden.
---

# Dashboard Local Browser Access

Use the user's Chromium/Chrome extension browser on the same remote host as the repository. In this setup the provider may report Chromium as “Chrome”. Use `cua_repl` for every browser interaction.

## Browser and app startup

1. Check `cua.getState()` for the extension browser and its current tabs. Reuse the existing browser tab when possible. If the browser is absent, tell the user that Chromium must be open on the remote host with the ChatGPT/Codex browser extension enabled; do not silently switch to a different machine or browser.
2. Check whether `http://localhost:5173/` is already serving the frontend before starting another server. If needed, start it from the repository root with:

   ```bash
   NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx serve frontend
   ```

   If Nx fails to process the project graph, start Vite directly from `apps/frontend`:

   ```bash
   /home/capic/.local/share/pnpm/pnpm exec vite --host 0.0.0.0 --port 5173
   ```

   Keep the server running while the user needs the app. Reuse an existing listener instead of starting a duplicate, and do not stop it unless asked.
3. Navigate directly to `http://localhost:5173/` and inspect the rendered page with the browser accessibility state. Respect browser URL policy rejections; do not try alternate browser surfaces, raw CDP, or indirect navigation to reach a blocked destination.

## Sign in

- Sign in only when the user asks to access the authenticated app or the requested task clearly requires it.
- If the app presents `/login`, use the Bitwarden connector to search for the dashboard's existing login item. Prefer an item whose saved URI identifies the same dashboard environment. If the only matching item is for a different environment, or the target backend is unclear, ask the user before submitting credentials.
- Enter the existing credentials through the visible login form, submit once, and verify success by confirming the app leaves `/login` and renders its authenticated navigation/dashboard. Do not repeat guesses after a failed login.
- Never print, quote, log, or save retrieved credentials in files or browser storage. Do not save the password when the browser offers. Do not reveal credential values in progress updates or the final response.

## Scope

This skill only covers starting/accessing the dashboard frontend and ordinary sign-in. It does not authorize changing accounts, passwords, permissions, or application data. Follow repository `AGENTS.md` instructions for any code changes.
