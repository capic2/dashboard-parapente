---
name: coderabbit-cli
description: Runs CodeRabbit CLI reviews and turns findings into an interactive correction workflow. Use at the end of an implementation, before shipping readiness, when a review workflow needs CodeRabbit checks, or when the user mentions CodeRabbit CLI, CodeRabbit review, `cr review`, or skipping CodeRabbit review.
---

# CodeRabbit CLI

## Quick Start

Use this skill at the end of an implementation, after code changes and relevant validation, before considering the work ready to ship.

Do not trigger this skill as a push-time step. A push should only happen after the implementation review state is already known.

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

## Implementation Integration

Implementation workflows should run this skill once the code changes are complete and relevant validation has run, unless the user explicitly asks to skip CodeRabbit review.

Recognize skip phrases such as `skip coderabbit`, `skip cr review`, `sans review coderabbit`, and `no coderabbit`.

If CodeRabbit returns findings, pause the implementation handoff. Present each finding one by one and ask whether to correct it, ignore it, or follow custom instructions. Consider the implementation complete only once all findings are fixed, explicitly ignored, or accepted by the user.

Shipping workflows may check whether CodeRabbit was already run for the completed implementation, but they must not treat CodeRabbit as part of the push step.

## Reporting Rules

Do not collapse all findings into a single summary.

Present findings one by one.

Keep each finding actionable and wait for the user's decision before modifying code for that finding.

If CodeRabbit reports no findings, state that the CodeRabbit review passed.
