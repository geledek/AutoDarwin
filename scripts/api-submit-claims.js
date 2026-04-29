/**
 * AutoDarwin - Direct API Claim Submitter
 *
 * Keeps the browser open during the entire process and makes API calls
 * from within the page context (using page.evaluate + fetch), so the
 * ASP.NET session stays alive.
 *
 * Flow:
 *   1. SSO login via real Chrome persistent context
 *   2. Navigate to RewardCentre (keeps session alive)
 *   3. For each claim:
 *      a. Upload receipt file via page-context fetch
 *      b. ValidateClaims via page-context fetch
 *      c. UpdateClaims via page-context fetch (if AUTO_SUBMIT=true)
 *   4. Close browser
 *
 * Prerequisites:
 *   Run "node scripts/discover-config.js" first
 *
 * Usage:
 *   node scripts/api-submit-claims.js [claims-data.json]
 *
 * Environment (.env):
 *   AUTO_SUBMIT=true  — Actually submit (default: dry-run, ValidateClaims only)
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { statSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CLAIMS_FILE = process.argv[2] || join(PROJECT_ROOT, 'claims-data.json');
const RESULTS_DIR = join(PROJECT_ROOT, 'results');
const CONFIG_FILE = join(PROJECT_ROOT, 'config', 'spending-account-config.json');

const SSO_URL = process.env.BENEFIT_WEBSITE_URL;
if (!SSO_URL) {
  console.log('❌ BENEFIT_WEBSITE_URL not set in .env');
  process.exit(1);
}
const CHROME_PROFILE = process.env.CHROME_PROFILE || join(process.env.HOME, 'Library/Application Support/Google/Chrome-Automation');

// ─── Config loader ────────────────────────────────────────────────────────────

let CONFIG;

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    CONFIG = JSON.parse(raw);
  } catch {
    console.log('❌ Config not found: config/spending-account-config.json');
    console.log('   Run "node scripts/discover-config.js" first.');
    process.exit(1);
  }

  const types = Object.keys(CONFIG.claimTypes || {});
  const claimants = CONFIG.claimants || [];
  const periods = CONFIG.benefitPeriods || [];

  if (types.length === 0) {
    console.log('❌ Config has no claim types. Re-run discover-config.js.');
    process.exit(1);
  }

  console.log(`  Config: ${types.length} claim types, ${claimants.length} claimants, ${periods.length} benefit periods`);
}

// Fuzzy match claim type name from OCR to config
function resolveClaimTypeID(ocrName) {
  const claimTypes = CONFIG.claimTypes;

  // Exact match
  if (claimTypes[ocrName]) return { name: ocrName, id: claimTypes[ocrName] };

  // Case-insensitive
  const lower = ocrName.toLowerCase().trim();
  for (const [name, id] of Object.entries(claimTypes)) {
    if (name.toLowerCase().trim() === lower) return { name, id };
  }

  // Containment
  for (const [name, id] of Object.entries(claimTypes)) {
    const nl = name.toLowerCase();
    if (nl.includes(lower) || lower.includes(nl)) return { name, id };
  }

  // Word overlap
  const ocrWords = lower.split(/[\s\-\/]+/).filter(w => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;
  for (const [name, id] of Object.entries(claimTypes)) {
    const nameWords = name.toLowerCase().split(/[\s\-\/]+/).filter(w => w.length > 2);
    let matched = 0;
    for (const ow of ocrWords) {
      if (nameWords.some(nw => nw.includes(ow) || ow.includes(nw))) matched++;
    }
    const score = ocrWords.length > 0 ? matched / ocrWords.length : 0;
    if (score > bestScore) { bestScore = score; bestMatch = { name, id }; }
  }
  if (bestMatch && bestScore >= 0.5) return bestMatch;
  return null;
}

function resolveClaimant(claimantName) {
  const claimants = CONFIG.claimants || [];
  if (!claimantName) return claimants.find(c => c.isSelf) || null;
  const lower = claimantName.toLowerCase();
  for (const c of claimants) {
    if (lower.includes((c.firstName || '').toLowerCase()) ||
        lower.includes((c.lastName || '').toLowerCase())) return c;
  }
  return claimants.find(c => c.isSelf) || null;
}

function getActiveBenefitPeriod() {
  const periods = CONFIG.benefitPeriods || [];
  return periods.find(p => p.canMakeClaim) || periods[periods.length - 1] || null;
}

// ─── API calls via page.evaluate (keeps session alive) ───────────────────────

async function apiGetViaPage(page, path) {
  return page.evaluate(async (p) => {
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    const res = await fetch(`/RewardCentre/${p}`, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        '__RequestVerificationToken': token,
      },
    });
    return { status: res.status, body: await res.text() };
  }, path);
}

async function apiPostViaPage(page, path, body) {
  return page.evaluate(async ({ p, b }) => {
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    const res = await fetch(`/RewardCentre/${p}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        '__RequestVerificationToken': token,
      },
      body: JSON.stringify(b),
    });
    return { status: res.status, body: await res.text() };
  }, { p: path, b: body });
}

async function uploadFileViaPage(page, fileBase64, fileName, mimeType, fileID, claimID) {
  return page.evaluate(async ({ base64, name, mime, fid, cid }) => {
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const file = new File([bytes], name, { type: mime });

    const form = new FormData();
    form.append('file', file);
    form.append('fileName', name);
    form.append('fileID', fid);
    form.append('claimID', cid);
    form.append('isResubmittedFile', 'false');

    const res = await fetch('/RewardCentre/Api/SpendingAccount/UploadReceiptFile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        '__RequestVerificationToken': token,
      },
      body: form,
    });
    return { status: res.status, body: await res.text() };
  }, { base64: fileBase64, name: fileName, mime: mimeType, fid: fileID, cid: claimID });
}

// ─── Build claim payload ─────────────────────────────────────────────────────

async function buildAndUploadClaim(page, claim) {
  // Resolve claim type
  const resolved = resolveClaimTypeID(claim.claimType);
  if (!resolved) {
    const available = Object.keys(CONFIG.claimTypes).join('\n      ');
    throw new Error(`No match for "${claim.claimType}".\n      Available:\n      ${available}`);
  }
  console.log(`    Type: "${claim.claimType}" -> "${resolved.name}" (${resolved.id})`);

  // Resolve claimant
  const claimant = resolveClaimant(claim.claimant);
  if (!claimant) throw new Error(`Cannot resolve claimant "${claim.claimant}"`);
  console.log(`    Claimant: ${claimant.firstName} ${claimant.lastName} ${claimant.isSelf ? '(self)' : `(${claimant.id})`}`);

  // Benefit period
  const period = getActiveBenefitPeriod();
  if (!period) throw new Error('No active benefit period');

  // Generate IDs for claim and file
  const claimID = randomUUID();
  const fileID = randomUUID();

  // Upload file
  const fileName = basename(claim.filePath);
  const fileBuffer = await readFile(claim.filePath);
  const fileSize = statSync(claim.filePath).size;
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeTypes = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  console.log(`    Uploading ${fileName} (${(fileSize / 1024).toFixed(1)} KB)...`);
  const fileBase64 = fileBuffer.toString('base64');
  const uploadRes = await uploadFileViaPage(page, fileBase64, fileName, mimeType, fileID, claimID);

  if (uploadRes.status !== 200) {
    throw new Error(`Upload failed: HTTP ${uploadRes.status} - ${uploadRes.body.substring(0, 200)}`);
  }

  let uploadResult;
  try { uploadResult = JSON.parse(uploadRes.body); } catch { uploadResult = uploadRes.body; }
  const returnedFileID = uploadResult.fileID || uploadResult.id || fileID;
  console.log(`    Uploaded -> fileID: ${returnedFileID}`);

  // Build receipt date
  const { dd, mm, yyyy } = claim.receiptDate;
  const receiptDateISO = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;

  return {
    id: claimID,
    status: 1,
    isNewClaim: true,
    benefitPeriodID: period.id,
    benefitPeriodName: period.name,
    dependantID: claimant.isSelf ? null : claimant.id,
    claimTypeID: resolved.id,
    claimantFirstName: claimant.firstName,
    claimantLastName: claimant.lastName,
    claimSubType1ID: '',
    claimSubType2ID: '',
    claimSubType3ID: '',
    textField1: claim.clinicProvider || '',
    textField2: claim.flowoverToFsa || '',
    dateField1: '',
    dateField2: '',
    receiptDate: receiptDateISO,
    formattingBrandID: '',
    fxReceiptAmount: null,
    receiptAmount: claim.receiptAmount,
    fxRate: null,
    claimedAmount: claim.receiptAmount,
    receiptNumber: claim.receiptNumber || '',
    isFlowExcessAmount: null,
    receiptFiles: [{
      fileID: returnedFileID,
      fileName,
      fileSize,
      rawFile: {},
      isReceiptAttachment: false
    }],
    isCaptureConsentAndAgreementChecked: null
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 AutoDarwin API Submitter\n');
  await mkdir(RESULTS_DIR, { recursive: true });

  // Load config
  console.log('📦 Loading config...');
  await loadConfig();

  // Load claims
  let claimsData;
  try {
    const raw = await readFile(CLAIMS_FILE, 'utf-8');
    claimsData = JSON.parse(raw);
  } catch {
    console.log(`\n❌ Could not load: ${CLAIMS_FILE}`);
    console.log('   Run "node scripts/process-receipts.js" first.');
    return;
  }

  const pendingClaims = claimsData.claims.filter(c => c.status === 'pending');
  if (pendingClaims.length === 0) {
    console.log('\n✅ No pending claims.');
    return;
  }

  const autoSubmit = process.env.AUTO_SUBMIT === 'true';
  console.log(`\n  Pending: ${pendingClaims.length}`);
  console.log(`  AUTO_SUBMIT: ${autoSubmit ? 'YES' : 'NO (dry run)'}\n`);

  // Launch browser and login
  console.log('🌐 Launching Chrome...');
  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: false,
    slowMo: 50,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('🔐 SSO login...');
  await page.goto(SSO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(url => url.toString().includes('RewardCentre'), { timeout: 60000 });
  await page.waitForTimeout(5000);
  try { await page.locator('#truste-consent-button').click({ timeout: 3000 }); } catch {}
  try {
    for (const btn of await page.locator('[class*="close"], [aria-label="close"], .notification-close').all()) {
      if (await btn.isVisible({ timeout: 500 })) await btn.click().catch(() => {});
    }
  } catch {}
  await page.waitForTimeout(3000);

  // Navigate to SpendingAccount to ensure session is established
  console.log('  Navigating to SpendingAccount...');
  const curUrl = page.url();
  await page.goto(curUrl.replace(/#\/.*$/, '#/SpendingAccount'), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Verify session
  console.log('  Verifying session...');
  console.log('  Current URL:', page.url());

  // Read the anti-forgery token from hidden input
  const verificationToken = await page.evaluate(() => {
    const input = document.querySelector('input[name="__RequestVerificationToken"]');
    return input?.value || '';
  });
  console.log('  Token found:', verificationToken ? 'yes' : 'no');

  // Try with the verification token from the hidden input
  const check = await page.evaluate(async (token) => {
    try {
      const res = await fetch('/RewardCentre/Api/Member/GetMemberDetails', {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          '__RequestVerificationToken': token,
        },
      });
      return { status: res.status, body: await res.text() };
    } catch(e) {
      return { status: -1, body: e.message };
    }
  }, verificationToken);
  console.log('  GetMemberDetails:', check.status);

  if (check.status !== 200) {
    console.log('  Response:', check.body.substring(0, 200));
    console.log('❌ Session invalid. Cannot proceed.');
    await context.close();
    return;
  }
  const member = JSON.parse(check.body);
  console.log(`  ✅ ${member.firstName} ${member.lastName} (${member.username})\n`);

  // Process claims
  const results = [];

  for (let i = 0; i < pendingClaims.length; i++) {
    const claim = pendingClaims[i];
    console.log(`\n═══ Claim ${i + 1}/${pendingClaims.length}: ${claim.file} ═══`);
    console.log(`  Type:     ${claim.claimType}`);
    console.log(`  Amount:   ${claim.currency} ${claim.receiptAmount}`);
    console.log(`  Claimant: ${claim.claimant}`);

    try {
      console.log('\n  [1/3] Building payload + uploading receipt...');
      const payload = await buildAndUploadClaim(page, claim);

      console.log('\n  [2/3] ValidateClaims...');
      const valRes = await apiPostViaPage(page, 'Api/SpendingAccount/ValidateClaims', [payload]);
      if (valRes.status !== 200) {
        throw new Error(`ValidateClaims HTTP ${valRes.status}: ${valRes.body.substring(0, 300)}`);
      }
      let valResult;
      try { valResult = JSON.parse(valRes.body); } catch { valResult = valRes.body; }
      if (Array.isArray(valResult)) {
        const errors = valResult.filter(r => r.errors && r.errors.length > 0);
        if (errors.length > 0) {
          throw new Error(`Validation errors: ${errors.flatMap(r => r.errors).join('; ')}`);
        }
      }
      console.log('    Validation OK');

      if (!autoSubmit) {
        console.log('\n  ⏸  Dry run — skipping UpdateClaims. Set AUTO_SUBMIT=true to submit.');
        results.push({ file: claim.file, status: 'validated', payload });
        continue;
      }

      console.log('\n  [3/3] UpdateClaims...');
      const subRes = await apiPostViaPage(page, 'Api/SpendingAccount/UpdateClaims', [payload]);
      if (subRes.status !== 200) {
        throw new Error(`UpdateClaims HTTP ${subRes.status}: ${subRes.body.substring(0, 300)}`);
      }
      let subResult;
      try { subResult = JSON.parse(subRes.body); } catch { subResult = subRes.body; }

      const refNumber = Array.isArray(subResult)
        ? subResult[0]?.referenceNumber || subResult[0]?.id
        : subResult?.referenceNumber || subResult?.id;

      console.log(`\n  ✅ Submitted! Reference: ${refNumber || '(check results file)'}`);
      results.push({ file: claim.file, status: 'submitted', reference: refNumber, submitResult: subResult });

    } catch (err) {
      console.log(`\n  ❌ Error: ${err.message}`);
      results.push({ file: claim.file, status: 'error', error: err.message });
    }
  }

  // Update claims-data.json
  for (const result of results) {
    const claim = claimsData.claims.find(c => c.file === result.file);
    if (claim) {
      claim.status = result.status;
      if (result.reference) claim.reference = result.reference;
      claim.submittedAt = new Date().toISOString();
    }
  }
  await writeFile(CLAIMS_FILE, JSON.stringify(claimsData, null, 2));

  // Save results
  const resultsFile = join(RESULTS_DIR, 'api-submission-results.json');
  await writeFile(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    autoSubmit,
    results,
    summary: {
      total: results.length,
      submitted: results.filter(r => r.status === 'submitted').length,
      validated: results.filter(r => r.status === 'validated').length,
      errors: results.filter(r => r.status === 'error').length,
    }
  }, null, 2));

  console.log('\n\n═══ Summary ═══');
  console.log(`  Submitted:  ${results.filter(r => r.status === 'submitted').length}`);
  console.log(`  Validated:  ${results.filter(r => r.status === 'validated').length}`);
  console.log(`  Errors:     ${results.filter(r => r.status === 'error').length}`);
  if (results.some(r => r.status === 'error')) {
    results.filter(r => r.status === 'error').forEach(r =>
      console.log(`    ${r.file}: ${r.error}`)
    );
  }
  console.log(`\n  Results: ${resultsFile}`);

  await context.close();
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
