---
description: Submit FlexiBen expense claims from receipt files
argument-hint: [receipt-file-or-folder]
allowed-tools: [Read, Glob, Grep, Bash, Write, Edit, Agent]
---

# FlexiBen Claim Submission

Submit expense claims through the AutoDarwin pipeline.

## Arguments

`$ARGUMENTS` may contain:
- A file path to a receipt (PDF/JPG/PNG)
- A folder path containing receipts
- Empty (process any pending claims in `claims-data.json`)

## Workflow

1. **If receipt files provided**: Copy them to `${CLAUDE_PLUGIN_ROOT}/receipts/`
2. **If JPEG/PNG files**: Convert to PDF using Python PIL before submission (server only accepts PDF)
3. **Check config exists**: If `${CLAUDE_PLUGIN_ROOT}/config/spending-account-config.json` is missing, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/discover-config.js` first
4. **OCR receipts**: Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/process-receipts.js`
5. **Review extracted data**: Show the user what was extracted and confirm before submission
6. **Submit claims**: Run `AUTO_SUBMIT=true node ${CLAUDE_PLUGIN_ROOT}/scripts/api-submit-claims.js`
7. **Report results**: Show reference numbers and any errors
8. **If Excel tracker exists**: Update it with submission results using openpyxl

## Error Handling

- If a claim fails validation, show the error and ask if the user wants to fix and retry
- Common fix: date dd/mm swap (`FutureDateNotAllowed`)
- Common fix: missing `flowoverToFsa` field (`TextField2 Required`) — set to "No"
- If balance exceeded, inform user and mark claim accordingly
