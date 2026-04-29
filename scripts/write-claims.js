/**
 * write-claims.js — Write claim data to claims-data.json
 *
 * Accepts extracted claim data (from Claude Code's vision or any other source)
 * and merges it into claims-data.json. Designed to be called by Claude Code
 * after it reads receipts directly with its native PDF/image vision.
 *
 * Usage:
 *   echo '<json-array>' | node scripts/write-claims.js
 *   node scripts/write-claims.js '<json-array>'
 *   node scripts/write-claims.js --file claims-input.json
 *
 * Input format (JSON array):
 * [
 *   {
 *     "file": "receipt.pdf",
 *     "filePath": "/absolute/path/to/receipt.pdf",
 *     "claimant": "Patient Name",
 *     "claimType": "FSA - Veterinary Medical Fees",
 *     "clinicProvider": "Island Vet Clinic",
 *     "receiptDate": { "dd": "03", "mm": "03", "yyyy": "2026" },
 *     "receiptAmount": 618,
 *     "receiptNumber": "IVC-16175",
 *     "currency": "SGD",
 *     "flowoverToFsa": "No"
 *   }
 * ]
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CLAIMS_FILE = join(PROJECT_ROOT, 'claims-data.json');

const REQUIRED_FIELDS = ['file', 'filePath', 'claimType', 'receiptAmount', 'receiptDate'];

function validate(claim, index) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!claim[field]) errors.push(`claim[${index}]: missing required field "${field}"`);
  }
  if (claim.receiptDate) {
    const { dd, mm, yyyy } = claim.receiptDate;
    if (!dd || !mm || !yyyy) errors.push(`claim[${index}]: receiptDate needs dd, mm, yyyy`);
  }
  if (claim.receiptAmount && typeof claim.receiptAmount !== 'number') {
    errors.push(`claim[${index}]: receiptAmount must be a number`);
  }
  return errors;
}

async function loadExisting() {
  try {
    const raw = await readFile(CLAIMS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { claims: [], errors: [] };
  }
}

async function main() {
  // Read input from CLI arg, --file, or stdin
  let input;

  const fileArgIdx = process.argv.indexOf('--file');
  if (fileArgIdx !== -1 && process.argv[fileArgIdx + 1]) {
    input = await readFile(process.argv[fileArgIdx + 1], 'utf-8');
  } else if (process.argv[2] && process.argv[2] !== '--file') {
    input = process.argv[2];
  } else {
    // Read from stdin
    const chunks = [];
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = chunks.join('');
  }

  if (!input || !input.trim()) {
    console.error('Error: No input provided.');
    console.error('Usage: echo \'[...]\' | node scripts/write-claims.js');
    console.error('       node scripts/write-claims.js \'[...]\'');
    console.error('       node scripts/write-claims.js --file input.json');
    process.exit(1);
  }

  let newClaims;
  try {
    newClaims = JSON.parse(input);
    if (!Array.isArray(newClaims)) newClaims = [newClaims];
  } catch (err) {
    console.error(`Error: Invalid JSON input: ${err.message}`);
    process.exit(1);
  }

  // Validate
  const allErrors = [];
  for (let i = 0; i < newClaims.length; i++) {
    allErrors.push(...validate(newClaims[i], i));
  }
  if (allErrors.length > 0) {
    console.error('Validation errors:');
    allErrors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }

  // Load existing and merge (deduplicate by file name)
  const existing = await loadExisting();
  const existingFiles = new Set(existing.claims.map(c => c.file));

  let added = 0;
  let skipped = 0;

  for (const claim of newClaims) {
    if (existingFiles.has(claim.file)) {
      console.log(`  Skip (already exists): ${claim.file}`);
      skipped++;
      continue;
    }

    existing.claims.push({
      ...claim,
      currency: claim.currency || 'SGD',
      flowoverToFsa: claim.flowoverToFsa || 'No',
      status: 'pending',
      extractedAt: new Date().toISOString(),
    });
    added++;
    console.log(`  Added: ${claim.file} — ${claim.claimType} — ${claim.currency || 'SGD'} ${claim.receiptAmount}`);
  }

  // Save
  existing.processedAt = new Date().toISOString();
  existing.totalFiles = existing.claims.length;
  existing.successCount = existing.claims.length;
  await writeFile(CLAIMS_FILE, JSON.stringify(existing, null, 2));

  console.log(`\nDone: ${added} added, ${skipped} skipped (duplicate).`);
  console.log(`Total claims: ${existing.claims.length} (${existing.claims.filter(c => c.status === 'pending').length} pending)`);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
