# AutoDarwin

Automate SAP FlexiBen claim submissions. Drop your receipts, Claude reads them, submits the claims — no manual form filling.

## Setup

```bash
git clone <repo-url>
cd AutoDarwin
npm install
node scripts/discover-config.js
```

The last command opens Chrome for SSO login and captures all claim type IDs, claimants, and benefit periods. Run it once (or again when a new benefit year starts).

**Requirements:** Node.js 18+, Google Chrome, Python 3 with Pillow (`pip install Pillow`)

## Usage

In Claude Code, just say:

```
submit this receipt /path/to/receipt.pdf
```

Or use the slash command:

```
/submit-claims /path/to/receipts/
```

Claude reads the receipt (PDF/image), extracts the data, and submits via the Darwin API. No Anthropic API key needed.

## How It Works

1. **You provide receipt files** (PDF preferred; JPG/PNG auto-converted to PDF)
2. **Claude reads them** using native vision and extracts: claimant, claim type, provider, date, amount
3. **Claim data is written** to `claims-data.json`
4. **Browser opens for SSO**, then claims are submitted via API (upload → validate → submit)
5. **Reference numbers returned** for each successful claim

## Troubleshooting

| Error | Fix |
|-------|-----|
| `FutureDateNotAllowed` | Date dd/mm is probably swapped — fix in claims-data.json |
| `TextField2 Required` | Add `"flowoverToFsa": "No"` to the claim |
| `ClaimedAmountExceedsAvailableBalance` | Insufficient account balance |
| Upload 415 error | File must be PDF — convert JPG/PNG first |

## Manual / Batch Mode

For headless automation without Claude in the loop (requires `ANTHROPIC_API_KEY` in `.env`):

```bash
node scripts/process-receipts.js receipts/
AUTO_SUBMIT=true node scripts/api-submit-claims.js
```

## Testing

```bash
node tests/test-pipeline.js
```

## Project Structure

```
AutoDarwin/
├── scripts/
│   ├── discover-config.js      # One-time: capture all form IDs via CDP
│   ├── write-claims.js         # Write extracted claim data to claims-data.json
│   ├── api-submit-claims.js    # Submit claims via Darwin API
│   └── process-receipts.js     # Batch OCR (optional, needs API key)
├── config/                     # Auto-generated config (gitignored)
├── commands/submit-claims.md   # /submit-claims slash command
├── skills/flexiben-claims/     # Claude Code skill (auto-triggers)
├── tests/                      # Pipeline tests
├── receipts/                   # Drop receipts here (gitignored)
└── results/                    # Submission results (gitignored)
```
