---
name: flexiben-claims
description: >
  This skill should be used when the user asks to "submit claims", "submit receipts",
  "file a claim", "process invoices", "OCR my receipts", "submit my expenses",
  "refresh claim config", "discover form IDs", "check my claims", "update the Excel",
  "claim submission", "FlexiBen", "flexiplan", "spending account claim",
  or provides receipt/invoice files for reimbursement processing.
version: 1.0.0
---

# AutoDarwin FlexiBen Claim Submission

Automated pipeline for submitting SAP FlexiBen (Darwin) spending account claims.

## Overview

AutoDarwin automates the end-to-end claim submission workflow:
1. **Discover** — Auto-capture all form field IDs from the Darwin platform via CDP
2. **Process** — OCR receipts using Claude Vision API to extract claim data
3. **Submit** — Upload files and submit claims via direct API calls
4. **Track** — Update the Excel tracker with submission results

## Project Location

All scripts and config live at `${CLAUDE_PLUGIN_ROOT}`.

## Pipeline Scripts

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `scripts/discover-config.js` | Auto-discover claim types, claimants, benefit periods via CDP | Once initially, or when config changes |
| `scripts/write-claims.js` | Write extracted claim data to `claims-data.json` | After reading receipts (called by Claude) |
| `scripts/api-submit-claims.js` | Upload + validate + submit claims via page-context API | After writing claims |
| `scripts/process-receipts.js` | Batch OCR via Anthropic API (optional, needs API key) | Only for headless/batch mode |

## Workflow

### 1. Discover Configuration (Run Once)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/discover-config.js
```

Opens real Chrome via SSO, intercepts `SpendingAccount/Load` API via CDP, and saves:
- `config/spending-account-config.json` — all claim type IDs, claimants, benefit periods
- `config/session-cookies.json` — auth cookies for reuse

Re-run when claim types or benefit periods change (e.g., new year).

### 2. Read Receipts and Extract Data (Claude does this)

Claude Code reads each receipt file using its native PDF/image vision. No API key needed.
Extract: claimant, claim type (match exact name from config), provider, date, amount, receipt number.

Then write to claims-data.json:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/write-claims.js '[{...extracted data...}]'
```

The `write-claims.js` script:
- Accepts JSON array of claims from CLI arg or stdin
- Merges with existing `claims-data.json` (skips duplicates by filename)
- Validates required fields
- Sets status to "pending"

### 3. Submit Claims

```bash
# Dry run (validate only — no actual submission)
node ${CLAUDE_PLUGIN_ROOT}/scripts/api-submit-claims.js

# Actually submit
AUTO_SUBMIT=true node ${CLAUDE_PLUGIN_ROOT}/scripts/api-submit-claims.js
```

- Opens Chrome for SSO, keeps browser alive during API calls
- For each pending claim: upload file -> ValidateClaims -> UpdateClaims
- Reads `__RequestVerificationToken` from hidden input for CSRF
- Results saved to `results/api-submission-results.json`

### Alternative: Batch Mode (requires ANTHROPIC_API_KEY)

For headless batch processing without Claude Code in the loop:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/process-receipts.js [receipts-folder]
```
This calls the Anthropic API directly for OCR. Requires `ANTHROPIC_API_KEY` in `.env`.

### 4. Update Excel Tracker

After submission, update the Excel file at the user's specified location with:
- Submission status (Submitted/Error/Pending)
- Reference numbers
- Submitted timestamps

Use openpyxl (Python) to read/write the Excel file. Keep only submission-relevant columns.

## Important Technical Details

### Authentication
- SSO login via Playwright persistent Chrome profile (path configured in scripts, defaults to `~/Library/Application Support/Google/Chrome-Automation`)
- Session is tied to the browser — API calls must happen via `page.evaluate(fetch(...))` while browser is open
- `__AntiForgeryCookie` is httpOnly (not readable from JS); use the `__RequestVerificationToken` from hidden input instead

### File Upload
- Server only accepts **PDF** files — convert JPEG/PNG to PDF before upload using `PIL` (Python)
- FormData fields: `file`, `fileName`, `fileID`, `claimID`, `isResubmittedFile`
- Generate `fileID` and `claimID` as UUIDs before upload

### Claim Payload Fields
- `textField1` = Clinic/Provider Name (always required)
- `textField2` = "Flowover to FSA (Yes/No)?" — **required for MSA dental and some other types**
- Check `isTextField2Mandatory` in claim type config to know when it's needed
- Receipt date format: ISO 8601 `YYYY-MM-DDTHH:mm:ss.000Z`

### Common Validation Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `FutureDateNotAllowed` | Receipt date is in the future | Fix dd/mm swap |
| `TextField2 Required` | Flowover field missing | Set textField2 to "No" (or "Yes") |
| `ClaimedAmountExceedsAvailableBalance` | Insufficient account balance | Reduce amount or use different account |
| `FileType` error (415) | Wrong upload FormData fields | Must include fileName, fileID, claimID |

### Claim Type Matching
- OCR output claim type names may not exactly match Darwin labels
- Fuzzy matching resolves: exact -> case-insensitive -> containment -> word overlap (>=50%)

## Additional Resources

### Reference Files
- **`references/claim-types.md`** — Full list of 41 claim types with IDs and field requirements
- **`references/api-endpoints.md`** — API endpoint details, payload structures, error codes

### Config Files
- **`config/spending-account-config.json`** — Auto-discovered form field IDs (generated by discover-config.js)
- **`config/spending-account-load-raw.json`** — Raw SpendingAccount/Load API response

## Quick Reference: Common Commands

```bash
# Write claims (after Claude reads receipts)
node ${CLAUDE_PLUGIN_ROOT}/scripts/write-claims.js '[{"file":"x.pdf","filePath":"/path/x.pdf","claimType":"...","receiptAmount":260,"receiptDate":{"dd":"01","mm":"03","yyyy":"2026"},"claimant":"...","clinicProvider":"...","receiptNumber":"..."}]'

# Submit claims
AUTO_SUBMIT=true node ${CLAUDE_PLUGIN_ROOT}/scripts/api-submit-claims.js

# Refresh config (new year or type changes)
node ${CLAUDE_PLUGIN_ROOT}/scripts/discover-config.js

# Batch mode (needs ANTHROPIC_API_KEY)
node ${CLAUDE_PLUGIN_ROOT}/scripts/process-receipts.js [folder]

# Run tests
node ${CLAUDE_PLUGIN_ROOT}/tests/test-pipeline.js
```
