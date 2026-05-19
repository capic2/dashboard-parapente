---
name: storybook-visual-preview
description: Captures and exports Storybook screenshots for UI work in the dashboard-parapente Nx monorepo. Use when the user asks for a visual preview, screenshot, aperçu visuel, Storybook capture, responsive check, or wants to see a developed frontend feature.
---

# Storybook Visual Preview

## Purpose

Use this skill to produce a concrete visual preview of a Storybook story after frontend or design-system work.

Important limitation: some chat/API clients do not render images read from tools, and some users do not have access to local workspace files. In that case, do not claim the screenshot is visible to the user. Report the limitation clearly and ask for, or use, an accessible delivery channel such as a PR comment, GitHub artifact, public/internal file hosting, or a client that supports image attachments.

The workflow is:

1. Run the relevant Storybook server.
2. Capture one or more stories with Playwright.
3. Export the generated PNG to a stable preview path.
4. Try reading the PNG so clients that support inline images can display it.
5. Always provide the PNG path and a Markdown image link for users with workspace access.
6. If the user is chat-only, provide a short visual diagnosis and explain that a viewable image requires an attachment-capable client or upload target.
## Project Defaults

- Frontend Storybook target: `nx storybook frontend`, port `6006`.
- Design system Storybook target: `nx storybook design-system`, port `6007`.
- Screenshot script: `.agents/skills/storybook-visual-preview/scripts/capture-storybook.mjs`.
- Default output directory: `.codenomad/storybook-previews` when the user should open the file, or `/tmp/opencode/storybook-visual-preview` for disposable captures.
- Browser fallback: if Playwright browsers are missing, the script tries `/usr/bin/chromium`.

Use `local-machine-stack` for the pnpm path, `NX_NO_CLOUD` prefix, dependency readiness, and command timeouts. If dependencies are missing, follow its readiness workflow before capturing.

## Quick Start

Start Storybook as a background process:

```bash
NX_NO_CLOUD=true <pnpm-from-local-machine-stack> nx storybook frontend
```

Capture a story by id:

```bash
node .agents/skills/storybook-visual-preview/scripts/capture-storybook.mjs \
  --base-url http://localhost:6006 \
  --story-id components-button--primary \
  --output .codenomad/storybook-previews/button-primary.png
```

Then use the Read tool on the PNG path and include this fallback:

```md
Preview: `.codenomad/storybook-previews/button-primary.png`

![Storybook preview](.codenomad/storybook-previews/button-primary.png)
```

## Workflow

- Determine the project from the changed files or user request: `frontend` or `design-system`.
- If the user did not provide a story id, find relevant `*.stories.tsx` files and infer likely story ids from the title/name.
- Start Storybook with `run_background_process`; do not block the main turn with a long-lived Bash command.
- Wait until the server prints its local URL or the capture script can load the page.
- Capture desktop first at `1440x1000` unless the user requested another viewport.
- For responsive work, also capture mobile at `390x844`.
- Prefer writing preview PNGs to `.codenomad/storybook-previews/<story-id>-<viewport>.png` so the user can open them from the workspace.
- Read every generated PNG that should be shown to the user, but do not assume the chat client will render the image.
- In the final response, always include the file path and a Markdown image link for every generated PNG.
- Stop the background Storybook process when the preview is complete unless it was already running before the task.

## Script Options

- `--base-url`: Storybook root URL, for example `http://localhost:6006`.
- `--story-id`: Storybook story id; builds `iframe.html?id=<story-id>` automatically.
- `--url`: Full Storybook or iframe URL; use this when a user gives an exact URL.
- `--output`: PNG destination path.
- `--width`: viewport width, default `1440`.
- `--height`: viewport height, default `1000`.
- `--timeout`: load timeout in milliseconds, default `30000`.
- `--full-page`: capture full page instead of viewport.

## Reporting

Keep the user-facing report concise:

- Mention which story and viewport were captured.
- Include the preview file path and Markdown image link.
- If the image did not render inline, say the client may not support image attachments from tool output.
- If the user has no workspace access, ask for an upload target or suggest creating a PR/check artifact.
- State obvious visual issues only if visible: clipped content, overlap, empty state, unreadable text, broken spacing, missing assets, horizontal scroll.
- If capture fails, report the Storybook URL, command, and the first actionable error.

## Guardrails

- Prefer `iframe.html?id=...` screenshots to avoid Storybook chrome unless the user asks for the full UI.
- Do not expose secrets from query params, local storage, logs, or environment output.
- Do not modify stories just to make a screenshot pass unless the user asked for a fix.
- If the story depends on backend services and renders broken data, report that dependency instead of faking state.
- For chat-only users who cannot open local files, give a visual text summary and offer one accessible delivery channel.
- Do not paste large base64 image blobs unless the user explicitly asks for that format.
