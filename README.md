# AutoDarwin

Automated SAP FlexiBen (Darwin) claim submission pipeline. OCR your receipts, auto-discover form field IDs, and submit claims directly via API — no manual form filling needed.

## What It Does

1. **Discover** — Logs into Darwin via SSO, intercepts the SpendingAccount config via CDP, and captures all claim type IDs, claimants, and benefit periods automatically
2. **Process** — OCR receipts (PDF/JPG/PNG) using Claude Vision API to extract claim data (provider, amount, date, type)
3. **Submit** — Uploads files and submits claims via direct API calls while keeping the browser session alive
4. **Track** — Updates an Excel tracker with submission status and reference numbers

## Prerequisites

- **Node.js** v18+
- **Google Chrome** installed (used for SSO authentication)
- **Anthropic API key** (for receipt OCR via Claude Vision)
- **Python 3** with Pillow (`pip install Pillow`) — for JPEG/PNG to PDF conversion
- **SAP FlexiBen account** with SpendingAccount feature enabled

## Setup

```bash
git clone <repo-url>
cd AutoDarwin
npm install
cp .env.example .env
# Edit .env with your Anthropic API key
```

On first run, Chrome will open for Microsoft SSO login. A persistent Chrome profile is created at `~/Library/Application Support/Google/Chrome-Automation` so you only need to authenticate once.

## Usage

### Step 1: Discover Configuration (run once)

```bash
node scripts/discover-config.js
```

Opens Chrome, logs in via SSO, navigates to SpendingAccount, and captures all form field IDs. Outputs:
- `config/spending-account-config.json` — all claim types, claimants, benefit periods
- `config/session-cookies.json` — auth cookies

Re-run when benefit periods change (e.g., new year).

### Step 2: Process Receipts

```bash
node scripts/process-receipts.js [receipts-folder]
```

- Default folder: `./receipts/`
- Reads each PDF/JPG/PNG, sends to Claude Vision API for OCR
- Extracts: claimant, claim type, provider, date, amount, receipt number
- Outputs: `claims-data.json`
- Accumulates across runs (only processes new files)

### Step 3: Submit Claims

```bash
# Dry run (validate only)
node scripts/api-submit-claims.js

# Actually submit
AUTO_SUBMIT=true node scripts/api-submit-claims.js
```

- Opens Chrome for SSO, keeps browser alive during submission
- For each pending claim: upload PDF → ValidateClaims → UpdateClaims
- Results saved to `results/api-submission-results.json`

### Quick One-Liner

```bash
cp ~/receipts/*.pdf receipts/ && node scripts/process-receipts.js && AUTO_SUBMIT=true node scripts/api-submit-claims.js
```

## Important Notes

### File Format
The Darwin server **only accepts PDF** files. If your receipts are JPEG/PNG, convert them first:

```python
from PIL import Image
Image.open('receipt.jpg').convert('RGB').save('receipt.pdf', 'PDF')
```

### Claim Type Matching
The OCR output is fuzzy-matched against the discovered Darwin claim type labels. If matching fails, check `config/spending-account-config.json` for the exact names.

### Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `FutureDateNotAllowed` | Receipt date in the future | Check dd/mm vs mm/dd swap |
| `TextField2 Required` | "Flowover to FSA" field missing | Set `flowoverToFsa: "No"` in claims-data.json |
| `ClaimedAmountExceedsAvailableBalance` | Insufficient account balance | Check remaining balance on portal |

### textField2 (Flowover to FSA)
Some MSA claim types (dental, medical, etc.) require a mandatory `textField2` field answering "Flowover to FSA (Yes/No)?". The OCR extraction sets this as "No" by default. Edit `claims-data.json` if you need to change it.

## Claude Code Plugin

This project is also a Claude Code plugin. To use it:

1. Create a local marketplace symlink:
   ```bash
   mkdir -p ~/.claude/plugins/marketplaces/autodarwin/plugins
   ln -s /path/to/AutoDarwin ~/.claude/plugins/marketplaces/autodarwin/plugins/autodarwin
   ```

2. Register in `~/.claude/plugins/installed_plugins.json` or install via Claude Code

3. Then just say "submit my receipts" or use `/submit-claims /path/to/receipt.pdf`

## Project Structure

```
AutoDarwin/
├── .claude-plugin/plugin.json    # Plugin manifest
├── commands/submit-claims.md     # /submit-claims slash command
├── skills/flexiben-claims/       # Auto-triggered skill
│   ├── SKILL.md
│   └── references/
├── scripts/
│   ├── discover-config.js        # Auto-discover form IDs via CDP
│   ├── process-receipts.js       # OCR receipts via Claude Vision
│   └── api-submit-claims.js      # Direct API submission
├── config/                       # Generated (gitignored)
├── receipts/                     # Drop receipts here (gitignored)
└── results/                      # Submission results (gitignored)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for receipt OCR |
| `AUTO_SUBMIT` | No | Set to `true` to actually submit (default: dry run) |
| `CLAUDE_MODEL` | No | Model for OCR (default: `claude-sonnet-4-5-20250929`) |
| `BENEFIT_WEBSITE_URL` | No | SSO launcher URL (has default for SAP) |

## License

MIT
