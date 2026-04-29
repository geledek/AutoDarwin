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
- Empty (submit any pending claims in `claims-data.json`)

## Workflow

### 1. Locate receipt files

If `$ARGUMENTS` is a file or folder, identify all PDF/JPG/PNG files to process.

### 2. Check config exists

Read `${CLAUDE_PLUGIN_ROOT}/config/spending-account-config.json`. If missing, run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/discover-config.js
```

### 3. Read and extract claim data (OCR via native vision)

For each receipt file, use the Read tool to view the file (Claude can read PDFs and images natively). Extract:

```json
{
  "file": "filename.pdf",
  "filePath": "/absolute/path/to/filename.pdf",
  "claimant": "Patient/client name",
  "claimType": "Exact claim type name from config",
  "clinicProvider": "Provider/clinic name",
  "receiptDate": { "dd": "15", "mm": "03", "yyyy": "2026" },
  "receiptAmount": 260,
  "receiptNumber": "Invoice/receipt number",
  "currency": "SGD",
  "flowoverToFsa": "No"
}
```

**Important rules for extraction:**
- Match `claimType` to the exact name in `config/spending-account-config.json`
- `receiptAmount` = total amount paid (including GST), as a number
- `receiptDate` = dd/mm/yyyy as zero-padded strings
- If textField2 is mandatory for this claim type (check `references/claim-types.md`), set `flowoverToFsa` to "No" (or "Yes" if amount exceeds MSA limit)

### 4. Convert images to PDF if needed

The Darwin server only accepts PDF. If receipt is JPG/PNG:
```bash
python3 -c "from PIL import Image; Image.open('file.jpg').convert('RGB').save('file.pdf', 'PDF')"
```

Update the `filePath` in the claim data to point to the PDF.

### 5. Write claims data

Pass the extracted JSON array to write-claims.js:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/write-claims.js '<json-array>'
```

### 6. Confirm with user

Show the extracted data in a table and ask for confirmation before submitting.

### 7. Submit claims

```bash
AUTO_SUBMIT=true node ${CLAUDE_PLUGIN_ROOT}/scripts/api-submit-claims.js
```

### 8. Report results

Show reference numbers, any errors, and suggested fixes.

## Error Handling

- `FutureDateNotAllowed` → Date dd/mm may be swapped. Fix and retry.
- `TextField2 Required` → Set `flowoverToFsa` to "No" in claims-data.json. Resubmit.
- `ClaimedAmountExceedsAvailableBalance` → Inform user, mark claim.
- Upload 415 error → File must be PDF. Convert and retry.
