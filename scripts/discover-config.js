/**
 * AutoDarwin — Discover SpendingAccount Configuration
 *
 * Logs into Darwin via real Chrome SSO, navigates to SpendingAccount, intercepts
 * the SpendingAccount/Load API response via CDP, and extracts all form field IDs:
 *   - Benefit periods (id, name, canMakeClaim)
 *   - Claimants (self + dependants with IDs)
 *   - Claim types (name → ID map, including subtypes)
 *   - Foreign currencies (if present)
 *
 * Output:
 *   config/spending-account-config.json  — structured config for api-submit-claims.js
 *   config/spending-account-load-raw.json — raw API response for debugging
 *
 * Usage:
 *   node scripts/discover-config.js
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_DIR = join(PROJECT_ROOT, 'config');

const SSO_URL = process.env.BENEFIT_WEBSITE_URL;
if (!SSO_URL) {
  console.log('❌ BENEFIT_WEBSITE_URL not set in .env');
  process.exit(1);
}
const CHROME_PROFILE = process.env.CHROME_PROFILE || join(process.env.HOME, 'Library/Application Support/Google/Chrome-Automation');
const BASE_URL = process.env.DARWIN_BASE_URL || 'https://ssl2.perquisite.net/RewardCentre/M/RC';

async function wait(page, ms = 3000) {
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.waitForTimeout(ms);
}

// ─── Extract subtypes recursively (up to 3 levels deep) ─────────────────────

function extractSubTypes(subTypes) {
  if (!Array.isArray(subTypes) || subTypes.length === 0) return [];
  return subTypes.map(st => ({
    id: st.id,
    name: st.displayName || st.name || st.description || st.id,
    captureConsent: st.captureConsent ?? null,
    subTypes: extractSubTypes(st.subTypes),
  }));
}

// ─── Parse the raw SpendingAccount/Load response into structured config ──────

function parseConfig(raw) {
  const config = {
    discoveredAt: new Date().toISOString(),
    benefitPeriods: [],
    claimants: [],
    claimTypes: {},
    claimSubTypes: {},
    claimTypeDetails: [],
    foreignCurrencies: [],
    settings: {},
  };

  // ── Benefit periods ──
  const years = raw.benefitYears || raw.BenefitYears || [];
  for (const y of years) {
    const period = {
      id: y.id || y.ID || y.benefitPeriodID,
      name: y.name || y.displayName || y.benefitPeriodName || `Year_${y.year}`,
      year: y.year,
      canMakeClaim: y.canMakeClaim ?? true,
      start: y.start || y.startDate,
      end: y.end || y.endDate,
    };
    config.benefitPeriods.push(period);

    // ── Claimants within this period ──
    const claimants = y.claimants || y.Claimants || [];
    for (const c of claimants) {
      const claimantId = c.id || c.dependantID;
      const existing = config.claimants.find(
        x => x.id === claimantId || (x.firstName === c.firstName && x.lastName === c.lastName)
      );
      if (!existing) {
        const isSelf = !claimantId || claimantId === '00000000-0000-0000-0000-000000000000';
        config.claimants.push({
          id: isSelf ? null : claimantId,
          firstName: c.firstName,
          lastName: c.lastName,
          isSelf,
        });
      }

      // ── Claim types available to this claimant in this period ──
      // Only capture from the active benefit year to avoid stale IDs
      if (!period.canMakeClaim) continue;

      const types = c.claimTypes || c.ClaimTypes || [];
      for (const t of types) {
        const name = t.displayName || t.name || t.description;
        const id = t.id || t.claimTypeID;
        if (!name || !id) continue;

        // Store ALL types (including claimNotAllowed) in details for reference
        const existingDetail = config.claimTypeDetails.find(d => d.id === id);
        if (!existingDetail) {
          config.claimTypeDetails.push({
            id,
            name,
            claimNotAllowed: t.claimNotAllowed ?? false,
            allowForeignCurrency: t.allowForeignCurrency ?? false,
            allowReceiptUpload: t.allowReceiptUpload ?? true,
            enableReceiptReader: t.enableReceiptReader ?? false,
            requiresClaimTypeAgreement: t.requiresClaimTypeAgreement ?? false,
            subTypes: extractSubTypes(t.subTypes),
          });
        }

        // Only add allowed types to the name→ID map
        if (t.claimNotAllowed) continue;
        if (!config.claimTypes[name]) {
          config.claimTypes[name] = id;
        }
      }
    }
  }

  // Rebuild claimSubTypes from claimTypeDetails
  for (const detail of config.claimTypeDetails) {
    if (detail.subTypes && detail.subTypes.length > 0) {
      config.claimSubTypes[detail.id] = detail.subTypes;
    }
  }

  // ── Foreign currencies ──
  const currencies = raw.foreignCurrencies || raw.ForeignCurrencies || [];
  for (const fc of currencies) {
    config.foreignCurrencies.push({
      brandID: fc.formattingBrandID || fc.id,
      name: fc.name || fc.displayName || fc.currencyCode,
      fxRates: (fc.effectiveDateFxRates || []).map(r => ({
        effectiveDate: r.effectiveDate,
        rate: r.fxRate,
      })),
    });
  }

  // ── Misc settings from top-level keys ──
  config.settings = {
    lockClaimAddition: raw.lockClaimAddition ?? false,
    isWindowProcessingOpen: raw.isWindowProcessingOpen ?? true,
    isExchangeRateAutomatic: raw.isExchangeRateAutomatic ?? false,
    memberStartDate: raw.memberStartDate || null,
    memberLeavingDate: raw.memberLeavingDate || null,
  };

  return config;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 AutoDarwin Config Discovery\n');
  await mkdir(CONFIG_DIR, { recursive: true });

  // Launch real Chrome with SSO profile
  console.log('🌐 Launching Chrome...');
  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: false,
    slowMo: 50,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // SSO login
  console.log('🔐 SSO login...');
  await page.goto(SSO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(url => url.toString().includes('RewardCentre'), { timeout: 60000 });
  await wait(page, 5000);
  try { await page.locator('#truste-consent-button').click({ timeout: 3000 }); } catch {}
  try {
    for (const btn of await page.locator('[class*="close"], [aria-label="close"], .notification-close').all()) {
      if (await btn.isVisible({ timeout: 500 })) await btn.click().catch(() => {});
    }
  } catch {}
  await wait(page, 3000);
  console.log('✅ Logged in\n');

  // ── Set up CDP network monitoring to capture ALL API responses ──
  console.log('\n📡 Setting up CDP network monitoring...');
  const cdpSession = await context.newCDPSession(page);

  // Use Network domain to passively capture responses (more reliable than Fetch interception)
  await cdpSession.send('Network.enable');

  const capturedResponses = {};

  cdpSession.on('Network.responseReceived', (event) => {
    const url = event.response.url;
    if (url.includes('/Api/')) {
      capturedResponses[event.requestId] = {
        url,
        status: event.response.status,
      };
    }
  });

  cdpSession.on('Network.loadingFinished', async (event) => {
    const entry = capturedResponses[event.requestId];
    if (!entry) return;

    try {
      const result = await cdpSession.send('Network.getResponseBody', { requestId: event.requestId });
      const body = result.base64Encoded
        ? Buffer.from(result.body, 'base64').toString('utf-8')
        : result.body;
      entry.body = body;
      entry.size = body.length;

      const shortUrl = entry.url.split('/Api/')[1] || entry.url;
      console.log(`  📥 ${shortUrl} (HTTP ${entry.status}, ${body.length} bytes)`);
    } catch {}
  });

  // ── Navigate to SpendingAccount (triggers the Load API call) ──
  console.log('\n📍 Navigating to SpendingAccount...');
  const currentUrl = page.url();
  const spendingUrl = currentUrl.replace(/#\/.*$/, '#/SpendingAccount');
  await page.goto(spendingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for page to settle and API calls to complete
  console.log('  Waiting for API responses...');
  await wait(page, 8000);

  // Check if we got redirected (feature disabled)
  const afterUrl = page.url();
  if (!afterUrl.includes('SpendingAccount')) {
    console.log(`\n  ⚠️ Redirected to: ${afterUrl}`);
    console.log('  SpendingAccount may be disabled. Trying direct API call as fallback...');
  }

  // Find the SpendingAccount/Load response from captured network traffic
  let rawBody = null;
  for (const entry of Object.values(capturedResponses)) {
    if (entry.url.includes('SpendingAccount/Load') && entry.body && entry.status === 200) {
      rawBody = entry.body;
      break;
    }
  }

  // Fallback: try calling the API directly using page's cookies
  if (!rawBody) {
    console.log('\n  SpendingAccount/Load not captured via navigation. Trying direct API call...');
    rawBody = await page.evaluate(async () => {
      try {
        const res = await fetch('/RewardCentre/Api/SpendingAccount/Load', {
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) return JSON.stringify({ error: `HTTP ${res.status}`, status: res.status });
        return await res.text();
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    });
  }

  // Save cookies (while session is still alive)
  const cookies = await context.cookies(new URL(BASE_URL).origin);
  await writeFile(join(CONFIG_DIR, 'session-cookies.json'), JSON.stringify(cookies, null, 2));
  console.log(`\n  Saved ${cookies.length} cookies to config/session-cookies.json`);

  if (!rawBody) {
    console.log('\n❌ Could not get SpendingAccount/Load response.');
    console.log('  Check if the feature is enabled on your account.');

    // Dump what we did capture for debugging
    const captured = Object.values(capturedResponses).map(e => ({
      url: e.url.split('/Api/')[1] || e.url,
      status: e.status,
      size: e.size || 0,
    }));
    console.log('\n  Captured API calls:');
    captured.forEach(c => console.log(`    ${c.url}: HTTP ${c.status} (${c.size} bytes)`));

    await context.close();
    return;
  }

  // Check if the response is an error
  try {
    const check = JSON.parse(rawBody);
    if (check.error) {
      console.log(`\n❌ SpendingAccount/Load error: ${check.error}`);
      if (check.status === 403) {
        console.log('  Feature is disabled. Contact HR to enable "Spending Account".');
      }
      await context.close();
      return;
    }
  } catch {
    // Not an error object, probably valid config — continue
  }

  // ── Parse and save ──
  console.log('\n📦 Parsing config...');
  let raw;
  try {
    raw = JSON.parse(rawBody);
  } catch (err) {
    console.log(`  ❌ Failed to parse JSON: ${err.message}`);
    await writeFile(join(CONFIG_DIR, 'spending-account-load-raw.txt'), rawBody);
    console.log('  Raw response saved to config/spending-account-load-raw.txt');
    await context.close();
    return;
  }

  // Save raw response
  await writeFile(join(CONFIG_DIR, 'spending-account-load-raw.json'), JSON.stringify(raw, null, 2));
  console.log('  Raw response → config/spending-account-load-raw.json');

  // Parse into structured config
  const config = parseConfig(raw);

  // Save structured config
  await writeFile(join(CONFIG_DIR, 'spending-account-config.json'), JSON.stringify(config, null, 2));
  console.log('  Structured config → config/spending-account-config.json');

  // ── Print summary ──
  console.log('\n\n═══ Discovery Results ═══\n');

  console.log('📅 Benefit Periods:');
  for (const bp of config.benefitPeriods) {
    console.log(`   ${bp.name} (${bp.id}) canMakeClaim=${bp.canMakeClaim}`);
  }

  console.log('\n👤 Claimants:');
  for (const c of config.claimants) {
    const tag = c.isSelf ? '(self)' : `(dependant: ${c.id})`;
    console.log(`   ${c.firstName} ${c.lastName} ${tag}`);
  }

  console.log('\n🏥 Claim Types:');
  const entries = Object.entries(config.claimTypes);
  for (const [name, id] of entries) {
    console.log(`   ${name}`);
    console.log(`     → ${id}`);
    if (config.claimSubTypes[id]) {
      for (const st of config.claimSubTypes[id]) {
        console.log(`       └─ ${st.name} (${st.id})`);
        for (const st2 of st.subTypes || []) {
          console.log(`          └─ ${st2.name} (${st2.id})`);
        }
      }
    }
  }

  if (config.foreignCurrencies.length > 0) {
    console.log('\n💱 Foreign Currencies:');
    for (const fc of config.foreignCurrencies) {
      console.log(`   ${fc.name || fc.brandID}`);
    }
  }

  console.log(`\n✅ Done. Found ${entries.length} claim types, ${config.claimants.length} claimants, ${config.benefitPeriods.length} benefit periods.`);
  console.log('   Config saved to: config/spending-account-config.json');

  await context.close();
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
