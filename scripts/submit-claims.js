import 'dotenv/config';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CLAIMS_FILE = process.argv[2] || join(PROJECT_ROOT, 'claims-data.json');
const RESULTS_DIR = join(PROJECT_ROOT, 'results');

const SSO_URL = process.env.BENEFIT_WEBSITE_URL;
const CHROME_PROFILE = process.env.CHROME_PROFILE || join(process.env.HOME, 'Library/Application Support/Google/Chrome-Automation');
const BASE_URL = process.env.DARWIN_BASE_URL || 'https://ssl2.perquisite.net/RewardCentre/M/RC';

let stepCounter = 0;
async function ss(page, name) {
  stepCounter++;
  const f = `submit-${String(stepCounter).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: join(RESULTS_DIR, f), fullPage: true });
  return f;
}

async function wait(page, ms = 3000) {
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.waitForTimeout(ms);
}

// Fuzzy match: find the best matching option in a darwin-select dropdown
function fuzzyScore(target, candidate) {
  const t = target.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();

  if (t === c) return 1.0;
  if (c.includes(t) || t.includes(c)) return 0.85;

  // Word-by-word matching
  const tWords = t.split(/\s+/);
  const cWords = c.split(/\s+/);
  let matchedWords = 0;
  for (const tw of tWords) {
    if (cWords.some(cw => cw.includes(tw) || tw.includes(cw))) matchedWords++;
  }
  if (tWords.length > 0) {
    const wordScore = matchedWords / tWords.length;
    if (wordScore > 0.5) return 0.4 + wordScore * 0.4;
  }

  return 0;
}

async function selectDarwinOption(page, selectorId, targetText, threshold = 0.3) {
  console.log(`    Selecting "${targetText}" in #${selectorId}...`);

  const darwinSelect = page.locator(`darwin-select#${selectorId}`);
  await darwinSelect.waitFor({ state: 'visible', timeout: 10000 });

  // Click to open dropdown
  await darwinSelect.click();
  await page.waitForTimeout(1500);

  // Get all visible options
  const options = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="option"], .option, .select-option, .animated-drop-down div[tabindex], .animated-drop-down li');
    return Array.from(items)
      .filter(el => el.offsetParent !== null)
      .map(el => ({ text: el.textContent?.trim(), index: Array.from(el.parentElement?.children || []).indexOf(el) }))
      .filter(o => o.text && o.text.length > 0);
  });

  if (options.length === 0) {
    console.log(`    ⚠️ No options found in #${selectorId}`);
    await page.keyboard.press('Escape');
    return false;
  }

  console.log(`    Options: ${options.map(o => `"${o.text}"`).join(', ')}`);

  // Find best match
  let bestMatch = null;
  let bestScore = 0;
  for (const opt of options) {
    const score = fuzzyScore(targetText, opt.text);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = opt;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    console.log(`    Matched: "${bestMatch.text}" (score: ${bestScore.toFixed(2)})`);

    // Click the matching option
    const optionEl = page.locator(`[role="option"]:has-text("${bestMatch.text}"), .option:has-text("${bestMatch.text}"), .select-option:has-text("${bestMatch.text}")`).first();
    if (await optionEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await optionEl.click();
    } else {
      // Fallback: click by text anywhere in dropdown
      await page.locator(`.animated-drop-down >> text="${bestMatch.text}"`).first().click().catch(async () => {
        // Last resort: use keyboard navigation
        for (let i = 0; i <= bestMatch.index; i++) {
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
        }
        await page.keyboard.press('Enter');
      });
    }

    await page.waitForTimeout(1000);
    return true;
  }

  console.log(`    ⚠️ No good match found (best: "${bestMatch?.text}" score: ${bestScore.toFixed(2)})`);
  await page.keyboard.press('Escape');
  return false;
}

async function fillClaimForm(page, claim) {
  console.log(`\n  📝 Filling claim form for: ${claim.file}`);

  // Select claimant
  if (claim.claimant) {
    await selectDarwinOption(page, 'claimant-0', claim.claimant, 0.3);
  }

  // Select claim type
  if (claim.claimType) {
    await selectDarwinOption(page, 'claimType-0', claim.claimType, 0.3);
  }

  await page.waitForTimeout(2000); // Wait for form to update based on claim type

  // Fill clinic/provider name
  if (claim.clinicProvider) {
    const providerInput = page.locator('darwin-input:near(:text("Clinic")) input, input[name*="clinic"], input[name*="provider"], input[placeholder*="clinic" i]').first();
    if (await providerInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await providerInput.fill(claim.clinicProvider);
      console.log(`    Provider: ${claim.clinicProvider}`);
    }
  }

  // Fill receipt amount
  if (claim.receiptAmount) {
    const amountInput = page.locator('#receipt-amount-0 input, input[id*="receipt-amount"], darwin-input[id*="receipt-amount"] input').first();
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill(String(claim.receiptAmount));
      console.log(`    Amount: ${claim.receiptAmount}`);
    }
  }

  // Fill receipt number
  if (claim.receiptNumber) {
    const receiptNumInput = page.locator('darwin-input#receipt-number-0 input, darwin-input[id*="receipt-number"] input, input[name*="receipt"]:not([name*="amount"])').first();
    if (await receiptNumInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await receiptNumInput.fill(claim.receiptNumber);
      console.log(`    Receipt#: ${claim.receiptNumber}`);
    }
  }

  // Fill date fields
  if (claim.receiptDate?.dd && claim.receiptDate?.mm && claim.receiptDate?.yyyy) {
    // Try individual day/month/year fields
    const dayInput = page.locator('input[name*="day"], input[placeholder*="DD"]').first();
    const monthInput = page.locator('input[name*="month"], input[placeholder*="MM"]').first();
    const yearInput = page.locator('input[name*="year"], input[placeholder*="YYYY"]').first();

    if (await dayInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dayInput.fill(claim.receiptDate.dd);
      if (await monthInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await monthInput.fill(claim.receiptDate.mm);
      }
      if (await yearInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await yearInput.fill(claim.receiptDate.yyyy);
      }
      console.log(`    Date: ${claim.receiptDate.dd}/${claim.receiptDate.mm}/${claim.receiptDate.yyyy}`);
    } else {
      // Try a single date input
      const dateInput = page.locator('input[type="date"], input[name*="date"]').first();
      if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateInput.fill(`${claim.receiptDate.yyyy}-${claim.receiptDate.mm}-${claim.receiptDate.dd}`);
      }
    }
  }

  // Handle "Flowover to FSA" if present
  if (claim.flowoverToFsa) {
    const flowoverSelect = page.locator('darwin-select:near(:text("Flowover")), darwin-select:near(:text("FSA"))').first();
    if (await flowoverSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await flowoverSelect.click();
      await page.waitForTimeout(1000);
      await page.locator(`text="${claim.flowoverToFsa}"`).first().click().catch(() => {});
      console.log(`    Flowover to FSA: ${claim.flowoverToFsa}`);
    }
  }

  // Upload receipt file
  if (claim.filePath) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(claim.filePath);
      await page.waitForTimeout(3000); // Wait for upload
      console.log(`    Uploaded: ${claim.file}`);
    }
  }
}

async function main() {
  console.log('🚀 AutoDarwin Claim Submitter\n');

  await mkdir(RESULTS_DIR, { recursive: true });

  // Load claims data
  let claimsData;
  try {
    const raw = await readFile(CLAIMS_FILE, 'utf-8');
    claimsData = JSON.parse(raw);
  } catch (err) {
    console.log(`❌ Could not load claims data from: ${CLAIMS_FILE}`);
    console.log('  Run "node scripts/process-receipts.js" first to extract receipt data.');
    return;
  }

  const pendingClaims = claimsData.claims.filter(c => c.status === 'pending');
  if (pendingClaims.length === 0) {
    console.log('✅ No pending claims to submit.');
    return;
  }

  console.log(`  Claims file: ${CLAIMS_FILE}`);
  console.log(`  Total claims: ${claimsData.claims.length}`);
  console.log(`  Pending: ${pendingClaims.length}\n`);

  // Launch browser
  console.log('🌐 Launching browser...');
  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: false,
    slowMo: 100,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // SSO Login
  console.log('🔐 SSO Login...');
  await page.goto(SSO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(url => url.toString().includes('RewardCentre'), { timeout: 60000 });
  await wait(page, 5000);
  try { await page.locator('#truste-consent-button').click({ timeout: 3000 }); } catch {}
  try {
    const closeBtns = page.locator('[class*="close"], [aria-label="close"], .notification-close');
    for (const btn of await closeBtns.all()) {
      if (await btn.isVisible({ timeout: 500 })) await btn.click().catch(() => {});
    }
  } catch {}
  await wait(page, 3000);
  console.log('✅ Logged in\n');

  // Navigate to SpendingAccount
  console.log('📍 Navigating to Spending Accounts...');
  const currentUrl = page.url();
  const spendingUrl = currentUrl.replace(/#\/.*$/, '#/SpendingAccount');
  await page.goto(spendingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(page, 5000);

  const finalUrl = page.url();
  if (!finalUrl.includes('SpendingAccount')) {
    console.log(`\n⚠️ SpendingAccount page is not accessible.`);
    console.log(`  URL: ${finalUrl}`);
    console.log(`  The SpendingAccount feature appears to be disabled (enableMatisseSpendingAccount: false).`);
    console.log(`  Please contact your benefits admin to enable the Spending Account feature.`);
    console.log(`  Once enabled, re-run this script.\n`);

    // Check if there's a nav item for Spending Accounts
    const navItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="navigation-item-"]')).map(el => el.textContent?.trim())
    );
    console.log(`  Available nav items: ${navItems.join(', ')}`);

    await ss(page, 'spending-account-blocked');
    await page.waitForTimeout(10000);
    await context.close();
    return;
  }

  console.log('✅ SpendingAccount page loaded\n');
  await ss(page, 'spending-account');

  // Process each claim
  const results = [];

  for (let i = 0; i < pendingClaims.length; i++) {
    const claim = pendingClaims[i];
    console.log(`\n═══ Claim ${i + 1}/${pendingClaims.length}: ${claim.file} ═══`);
    console.log(`  Type: ${claim.claimType}`);
    console.log(`  Amount: ${claim.currency} ${claim.receiptAmount}`);
    console.log(`  Claimant: ${claim.claimant}`);

    try {
      // Click "Make a Claim" button
      console.log('\n  Clicking "Make a Claim"...');
      const makeClaimBtn = page.locator('#add-claim-button, button:has-text("Make a Claim")').first();
      await makeClaimBtn.waitFor({ state: 'visible', timeout: 10000 });
      await makeClaimBtn.click();
      await wait(page, 3000);

      // Wait for overlay/form to appear
      const overlayVisible = await page.locator('.overlay-content').isVisible({ timeout: 10000 }).catch(() => false);
      if (!overlayVisible) {
        console.log('  ⚠️ Claim overlay did not appear');
        await ss(page, `claim-${i}-no-overlay`);
        results.push({ file: claim.file, status: 'error', error: 'Overlay not found' });
        continue;
      }

      await ss(page, `claim-${i}-overlay-open`);

      // Fill the form
      await fillClaimForm(page, claim);
      await ss(page, `claim-${i}-form-filled`);

      // Click Next/Submit
      console.log('\n  Clicking Next...');
      const nextBtn = page.locator('button:has-text("Next"):not([disabled])').first();
      if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nextBtn.click();
        await wait(page, 5000);
        await ss(page, `claim-${i}-review`);

        // Confirm/Submit
        const submitBtn = page.locator('button:has-text("Next"):not([disabled]), button:has-text("Submit"):not([disabled])').first();
        if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          // DON'T auto-submit - stage for review
          console.log('  📋 Claim staged for review.');
          console.log('  ⚠️ NOT auto-submitting. Review and submit manually, or set AUTO_SUBMIT=true in .env');

          if (process.env.AUTO_SUBMIT === 'true') {
            await submitBtn.click();
            await wait(page, 5000);
            await ss(page, `claim-${i}-submitted`);

            // Get confirmation number
            const confirmation = await page.evaluate(() => {
              const text = document.body.innerText;
              const refMatch = text.match(/reference\s*(?:number|#)?\s*:\s*(\S+)/i);
              return refMatch?.[1] || null;
            });

            console.log(`  ✅ Submitted! Reference: ${confirmation || '(check screenshot)'}`);

            // Click Finish
            const finishBtn = page.locator('button:has-text("Finish")').first();
            if (await finishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
              await finishBtn.click();
              await wait(page, 3000);
            }

            results.push({ file: claim.file, status: 'submitted', reference: confirmation });
          } else {
            results.push({ file: claim.file, status: 'staged' });
          }
        }
      } else {
        console.log('  ⚠️ Next button not found');
        results.push({ file: claim.file, status: 'error', error: 'Next button not found' });
      }

      // If not auto-submitting, close the overlay for next claim
      if (process.env.AUTO_SUBMIT !== 'true') {
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button:has-text("Back")').first();
        if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cancelBtn.click();
          await wait(page, 2000);
        }
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      results.push({ file: claim.file, status: 'error', error: err.message });
      await ss(page, `claim-${i}-error`);
    }
  }

  // Update claims data with results
  for (const result of results) {
    const claim = claimsData.claims.find(c => c.file === result.file);
    if (claim) {
      claim.status = result.status;
      claim.reference = result.reference;
      claim.submittedAt = new Date().toISOString();
    }
  }

  // Save updated claims data
  await writeFile(CLAIMS_FILE, JSON.stringify(claimsData, null, 2));

  // Save results
  await writeFile(join(RESULTS_DIR, 'submission-results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    totalProcessed: results.length,
    submitted: results.filter(r => r.status === 'submitted').length,
    staged: results.filter(r => r.status === 'staged').length,
    errors: results.filter(r => r.status === 'error').length
  }, null, 2));

  // Summary
  console.log('\n\n═══ Summary ═══');
  console.log(`  Total processed: ${results.length}`);
  console.log(`  Submitted: ${results.filter(r => r.status === 'submitted').length}`);
  console.log(`  Staged: ${results.filter(r => r.status === 'staged').length}`);
  console.log(`  Errors: ${results.filter(r => r.status === 'error').length}`);

  if (results.some(r => r.status === 'error')) {
    console.log('\n  Errors:');
    results.filter(r => r.status === 'error').forEach(r => console.log(`    ${r.file}: ${r.error}`));
  }

  console.log('\n  Results saved to: results/submission-results.json');
  console.log('  Screenshots saved to: results/');

  await page.waitForTimeout(30000);
  await context.close();
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
