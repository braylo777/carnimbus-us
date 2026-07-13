---
name: webapp-testing
description: >-
  Verifies a running web app end-to-end with Playwright — drives real user flows, asserts on visible
  behavior, and captures screenshots/console/network on failure. Use when asked to "test the UI",
  "verify the app works", "write a Playwright test", or to confirm a change works in the real app.
source: Anthropic anthropics/skills
allowed-tools: Read, Write, Bash
autonomy: L1-approve
---

# Webapp Testing

## When to use
After a frontend change, or when the user wants proof a flow works — login, form submit, navigation,
data render — driven through a real browser, not just unit tests.

## Steps
1. Confirm the app is running and get its URL (start the dev server if needed; note the port).
2. Use Playwright: launch (headless by default), navigate, and drive the flow with role/text-based
   locators (`getByRole`, `getByText`) — avoid brittle CSS/XPath.
3. Assert on user-visible outcomes: rendered text, URL change, element state — not internal impl.
4. Cover the happy path plus one failure/edge case (invalid input, empty state).
5. On failure, capture a screenshot, the console log, and failed network requests to the scratchpad
   for diagnosis.
6. Report pass/fail per flow with evidence. Leave the test file so it can rerun.

## DOV conventions (REQUIRED)
Save specs as `YYYY-MM-DD__DOV__<domain>__<topic>__ui-test__ready__v##.spec.js` and append the
pass/fail verdict to `ledger.jsonl`. Never point tests at production credentials or `00E-secret`;
use test/staging. Never `rm` artifacts — move to `~/.claude-trash`. Skip `._*`/dotfiles. For CNMB,
test against the CarNimbus Worker preview URL (Workers + D1 + Vectorize + Workers AI, vanilla JS);
deploy/promote only on "ship".

## Verify
The test actually loads the app (screenshot proves the real page), every assertion runs, and a
deliberately broken selector fails loudly rather than silently passing.
