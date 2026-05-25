---
name: coderabbit-cli
description: Runs CodeRabbit CLI reviews and turns findings into an interactive correction workflow. Use when a shipping, commit, push, or review workflow needs CodeRabbit checks, when preparing a commit or push with `cr review`, or when the user mentions CodeRabbit CLI, CodeRabbit review, `cr review`, or skipping CodeRabbit review.
---

# CodeRabbit CLI

## Quick Start

Use this skill before committing or pushing when a workflow requires CodeRabbit review.

Skip the review only when the user explicitly asks with phrases like:

- `skip coderabbit`
- `skip cr review`
- `sans review coderabbit`
- `no coderabbit`

## Workflow

1. Check whether CodeRabbit CLI is installed:

```sh
command -v cr
```

2. If `cr` is missing, install it:

```sh
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

3. Run the review:

```sh
cr review
```

4. If the command reports that authentication is required, start the login flow:

```sh
cr login
```

Then run `cr review` again.

5. Parse CodeRabbit output into individual findings.

For each finding, report:

- severity if available;
- file and line if available;
- CodeRabbit message;
- suggested fix if available.

6. Ask the user what to do for each finding:

```md
Finding 1: [severity] `path/to/file.ts:42`
CodeRabbit: ...
Suggested fix: ...

What would you like to do?
1. Fix
2. Ignore
3. Provide instructions
```

7. Apply only corrections explicitly approved by the user.

8. If the user gives custom instructions, follow them for that finding only unless they say otherwise.

9. Continue until every finding is fixed, ignored, or explicitly accepted.

10. Re-run relevant checks after making corrections.

11. Do not commit while unresolved CodeRabbit findings remain.

## Shipping Integration

Shipping, commit, or push workflows should run this skill before committing or pushing unless the user explicitly asks to skip CodeRabbit review.

Recognize skip phrases such as `skip coderabbit`, `skip cr review`, `sans review coderabbit`, and `no coderabbit`.

If CodeRabbit returns findings, pause the shipping flow. Present each finding one by one and ask whether to correct it, ignore it, or follow custom instructions. Resume commit only once all findings are fixed, explicitly ignored, or accepted by the user.

## Reporting Rules

Do not collapse all findings into a single summary.

Present findings one by one.

Keep each finding actionable and wait for the user's decision before modifying code for that finding.

If CodeRabbit reports no findings, state that the CodeRabbit review passed.
