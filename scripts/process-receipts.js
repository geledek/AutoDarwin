import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFile, readdir, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const RECEIPTS_DIR = process.argv[2] || join(PROJECT_ROOT, 'receipts');
const OUTPUT_FILE = join(PROJECT_ROOT, 'claims-data.json');
const CONFIG_FILE = join(PROJECT_ROOT, 'config', 'spending-account-config.json');

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

// Load claim type names from config if available, otherwise use fallback defaults
async function getClaimTypeList() {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw);
    const types = Object.keys(config.claimTypes || {});
    if (types.length > 0) {
      console.log(`  Using ${types.length} claim types from config/spending-account-config.json`);
      return types;
    }
  } catch {}

  console.log('  Using default claim type list (run discover-config.js for exact names)');
  return [
    'MSA - Medical Claim for GP and Specialist',
    'MSA - Medical Claim',
    'MSA - Physiotherapy/Developmental Therapy and Others',
    'MSA - Traditional Chinese Medicine',
    'MSA - Alternative Medicine',
    'MSA - Dental Claim',
    'MSA - Vision Expenses',
  ];
}

function buildExtractionPrompt(claimTypes) {
  const typeList = claimTypes.join(' | ');
  const typeExamples = claimTypes.map(t => {
    const tl = t.toLowerCase();
    if (tl.includes('gp') || tl.includes('specialist')) return `  - GP visits, specialist visits → "${t}"`;
    if (tl.includes('physiotherapy') || tl.includes('developmental')) return `  - Physiotherapy, chiropractic, occupational therapy → "${t}"`;
    if (tl.includes('traditional chinese') || tl.includes('tcm')) return `  - TCM, acupuncture, chinese herbs → "${t}"`;
    if (tl.includes('alternative')) return `  - Naturopathy, homeopathy, ayurvedic → "${t}"`;
    if (tl.includes('dental')) return `  - Dental work → "${t}"`;
    if (tl.includes('vision')) return `  - Eye care, glasses, contacts → "${t}"`;
    if (tl.includes('medical claim') && !tl.includes('gp')) return `  - General medical expenses → "${t}"`;
    return null;
  }).filter(Boolean).join('\n');

  return `You are an expert at reading medical receipts and invoices from Singapore clinics and healthcare providers.

Extract the following information from this receipt/invoice. Return ONLY valid JSON, no markdown.

{
  "claimant": "Patient name (look for 'Patient Name', 'Name', or the person the bill is addressed to)",
  "claim_type": "One of: ${typeList}",
  "clinic_provider": "Clinic or healthcare provider name",
  "receipt_date_dd": "Day as 2-digit string e.g. '15'",
  "receipt_date_mm": "Month as 2-digit string e.g. '03'",
  "receipt_date_yyyy": "Year as 4-digit string e.g. '2025'",
  "receipt_amount": "Total amount paid including GST, as a number without currency symbol",
  "receipt_number": "Invoice number, receipt number, or transaction reference",
  "currency": "SGD unless otherwise stated",
  "description": "Brief description of the service/treatment",
  "flowover_to_fsa": "Yes if the amount might exceed MSA limit, otherwise No"
}

Important rules:
- For "claimant", extract the PATIENT name, not the clinic name
- For "receipt_amount", always use the TOTAL amount (including GST/tax)
- For "claim_type", match the service to the most appropriate category:
${typeExamples}
- If you can't determine a field, set it to null
- Return ONLY the JSON object, no explanation`;
}

let EXTRACTION_PROMPT;

async function extractReceiptData(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mediaType = SUPPORTED_TYPES[ext];

  if (!mediaType) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const fileStats = await stat(filePath);
  if (fileStats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  const fileData = await readFile(filePath);
  const base64Data = fileData.toString('base64');

  const client = new Anthropic();

  const content = [{
    type: ext === '.pdf' ? 'document' : 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: base64Data
    }
  }, {
    type: 'text',
    text: EXTRACTION_PROMPT
  }];

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content }]
  });

  const responseText = response.content[0].text.trim();

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  return JSON.parse(jsonStr);
}

function normalizeAmount(amount) {
  if (amount === null || amount === undefined) return null;
  if (typeof amount === 'number') return amount;

  const cleaned = String(amount).replace(/[^0-9.,]/g, '');
  // Handle comma as thousands separator
  const normalized = cleaned.replace(/,(\d{3})/g, '$1').replace(/,/g, '.');
  return parseFloat(normalized) || null;
}

function normalizeDate(dd, mm, yyyy) {
  const day = String(dd || '').padStart(2, '0');
  const month = String(mm || '').padStart(2, '0');
  const year = String(yyyy || '');

  const d = parseInt(day);
  const m = parseInt(month);
  const y = parseInt(year);

  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2030) {
    return { dd: null, mm: null, yyyy: null };
  }

  return { dd: day, mm: month, yyyy: year };
}

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { claims: [], errors: [] };
  }
}

async function main() {
  console.log('📋 AutoDarwin Receipt Processor\n');
  console.log(`  Receipts folder: ${RECEIPTS_DIR}`);
  console.log(`  Model: ${CLAUDE_MODEL}`);

  // Build extraction prompt from config (or defaults)
  const claimTypes = await getClaimTypeList();
  EXTRACTION_PROMPT = buildExtractionPrompt(claimTypes);

  // Check if receipts folder exists
  try {
    await stat(RECEIPTS_DIR);
  } catch {
    console.log(`\n⚠️ Receipts folder not found: ${RECEIPTS_DIR}`);
    console.log('  Create the folder and add receipt files (JPG, PNG, PDF).');
    console.log('  Usage: node scripts/process-receipts.js [receipts-folder-path]');
    await mkdir(RECEIPTS_DIR, { recursive: true });
    console.log(`  Created empty folder: ${RECEIPTS_DIR}`);
    return;
  }

  // Load existing claims data (accumulate across runs)
  const existing = await loadExisting();
  const processedFiles = new Set(existing.claims.map(c => c.file));
  if (processedFiles.size > 0) {
    console.log(`  Previously processed: ${processedFiles.size} receipt(s)`);
  }

  // List receipt files
  const allFiles = (await readdir(RECEIPTS_DIR))
    .filter(f => Object.keys(SUPPORTED_TYPES).includes(extname(f).toLowerCase()))
    .sort();

  const newFiles = allFiles.filter(f => !processedFiles.has(f));

  if (allFiles.length === 0) {
    console.log('\n⚠️ No receipt files found in the folder.');
    console.log(`  Supported formats: ${Object.keys(SUPPORTED_TYPES).join(', ')}`);
    return;
  }

  if (newFiles.length === 0) {
    console.log(`\n✅ All ${allFiles.length} receipt(s) already processed. Nothing new to do.`);
    console.log(`   Next step: node scripts/submit-claims.js`);
    return;
  }

  console.log(`  Found ${allFiles.length} receipt file(s), ${newFiles.length} new\n`);

  const newClaims = [];
  const newErrors = [];

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];
    const filePath = join(RECEIPTS_DIR, file);

    console.log(`[${i + 1}/${newFiles.length}] Processing: ${file}`);

    try {
      const data = await extractReceiptData(filePath);

      // Normalize the data
      const amount = normalizeAmount(data.receipt_amount);
      const date = normalizeDate(data.receipt_date_dd, data.receipt_date_mm, data.receipt_date_yyyy);

      const claim = {
        file,
        filePath,
        claimant: data.claimant?.trim() || null,
        claimType: data.claim_type?.trim() || null,
        clinicProvider: data.clinic_provider?.trim() || null,
        receiptDate: date,
        receiptAmount: amount,
        receiptNumber: data.receipt_number?.trim() || null,
        currency: data.currency || 'SGD',
        description: data.description?.trim() || null,
        flowoverToFsa: data.flowover_to_fsa || 'No',
        status: 'pending',
        extractedAt: new Date().toISOString()
      };

      newClaims.push(claim);

      console.log(`  ✅ Claimant: ${claim.claimant || '(unknown)'}`);
      console.log(`     Type: ${claim.claimType || '(unknown)'}`);
      console.log(`     Provider: ${claim.clinicProvider || '(unknown)'}`);
      console.log(`     Date: ${date.dd}/${date.mm}/${date.yyyy}`);
      console.log(`     Amount: ${claim.currency} ${claim.receiptAmount}`);
      console.log(`     Receipt#: ${claim.receiptNumber || '(none)'}`);
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      newErrors.push({ file, error: err.message });
    }

    console.log('');
  }

  // Merge with existing data
  const allClaims = [...existing.claims, ...newClaims];
  const allErrors = [...existing.errors, ...newErrors];

  const output = {
    processedAt: new Date().toISOString(),
    receiptsFolder: RECEIPTS_DIR,
    totalFiles: allClaims.length + allErrors.length,
    successCount: allClaims.length,
    errorCount: allErrors.length,
    claims: allClaims,
    errors: allErrors
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✅ Results saved to: ${OUTPUT_FILE}`);
  console.log(`   This run: ${newClaims.length} new, ${newErrors.length} errors`);
  console.log(`   Total: ${allClaims.length} claims accumulated`);

  // Summary of ALL claims (existing + new)
  if (allClaims.length > 0) {
    console.log('\n📊 Summary (all claims):');
    const byType = {};
    const byStatus = {};
    let totalAmount = 0;
    for (const c of allClaims) {
      const type = c.claimType || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      totalAmount += c.receiptAmount || 0;
    }
    for (const [type, count] of Object.entries(byType)) {
      console.log(`   ${type}: ${count} claim(s)`);
    }
    console.log(`   Total amount: SGD ${totalAmount.toFixed(2)}`);
    console.log(`   Status: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}`);
    console.log(`\n   Next step: node scripts/submit-claims.js`);
  }
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
