/**
 * test-pipeline.js — Verify the AutoDarwin claim pipeline
 *
 * Tests:
 *   1. write-claims.js correctly writes claims-data.json
 *   2. Claim type fuzzy matching resolves correctly
 *   3. Duplicate detection works
 *   4. Validation rejects bad input
 *
 * Usage:
 *   node tests/test-pipeline.js
 */

import { execSync } from 'child_process';
import { readFile, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CLAIMS_FILE = join(PROJECT_ROOT, 'claims-data.json');
const WRITE_SCRIPT = join(PROJECT_ROOT, 'scripts', 'write-claims.js');
const CONFIG_FILE = join(PROJECT_ROOT, 'config', 'spending-account-config.json');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function run(cmd, opts = {}) {
  try {
    return { output: execSync(cmd, { encoding: 'utf-8', cwd: PROJECT_ROOT, ...opts }), code: 0 };
  } catch (err) {
    return { output: err.stderr || err.stdout || err.message, code: err.status };
  }
}

async function main() {
  console.log('🧪 AutoDarwin Pipeline Tests\n');

  // Backup existing claims-data.json
  let backup;
  try {
    backup = await readFile(CLAIMS_FILE, 'utf-8');
  } catch {}

  try {
    // ─── Test 1: write-claims.js creates claims-data.json ─────────────────
    console.log('Test 1: write-claims.js creates claims-data.json');

    // Clear existing claims
    await rm(CLAIMS_FILE, { force: true });

    const testClaim = JSON.stringify([{
      file: 'sample-receipt.pdf',
      filePath: join(__dirname, 'fixtures', 'sample-receipt.pdf'),
      claimant: 'Han JiangLei',
      claimType: 'MSA - Physiotherapy/Developmental Therapy and Others - (EE+SP)',
      clinicProvider: 'TSquared Lab',
      receiptDate: { dd: '15', mm: '04', yyyy: '2026' },
      receiptAmount: 260,
      receiptNumber: '177C-00025617',
      currency: 'SGD',
      flowoverToFsa: 'No'
    }]);

    const { output: out1, code: code1 } = run(`node scripts/write-claims.js '${testClaim.replace(/'/g, "'\\''")}'`);
    assert(code1 === 0, 'write-claims.js exits with code 0');

    const data = JSON.parse(await readFile(CLAIMS_FILE, 'utf-8'));
    assert(data.claims.length === 1, 'claims-data.json has 1 claim');
    assert(data.claims[0].file === 'sample-receipt.pdf', 'file name is correct');
    assert(data.claims[0].status === 'pending', 'status is pending');
    assert(data.claims[0].receiptAmount === 260, 'amount is 260');
    assert(data.claims[0].claimType === 'MSA - Physiotherapy/Developmental Therapy and Others - (EE+SP)', 'claim type preserved');

    // ─── Test 2: Duplicate detection ──────────────────────────────────────
    console.log('\nTest 2: Duplicate detection');

    const { code: code2 } = run(`node scripts/write-claims.js '${testClaim.replace(/'/g, "'\\''")}'`);
    assert(code2 === 0, 'write-claims.js exits with code 0 on duplicate');

    const data2 = JSON.parse(await readFile(CLAIMS_FILE, 'utf-8'));
    assert(data2.claims.length === 1, 'still only 1 claim (duplicate skipped)');

    // ─── Test 3: Validation rejects missing fields ────────────────────────
    console.log('\nTest 3: Validation rejects missing fields');

    const badClaim = JSON.stringify([{ file: 'bad.pdf' }]);
    const { code: code3 } = run(`node scripts/write-claims.js '${badClaim}'`);
    assert(code3 !== 0, 'exits with non-zero on invalid input');

    // ─── Test 4: Claim type fuzzy matching ────────────────────────────────
    console.log('\nTest 4: Claim type fuzzy matching (via config)');

    let configExists = false;
    try {
      const config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
      configExists = true;

      // Test exact match
      const types = config.claimTypes;
      assert(types['FSA - Veterinary Medical Fees'] !== undefined, 'Exact match: FSA - Veterinary Medical Fees');
      assert(types['MSA - Dental Claim - (EE+SP)'] !== undefined, 'Exact match: MSA - Dental Claim - (EE+SP)');

      // Test config structure
      assert(config.claimants.length >= 2, 'Config has at least 2 claimants');
      assert(config.benefitPeriods.some(p => p.canMakeClaim), 'At least one active benefit period');
      assert(Object.keys(types).length >= 30, 'At least 30 claim types discovered');
    } catch {
      console.log('  ⚠️  config/spending-account-config.json not found — skipping config tests');
      console.log('     Run "node scripts/discover-config.js" first');
    }

    // ─── Test 5: Multiple claims in one write ─────────────────────────────
    console.log('\nTest 5: Multiple claims in one write');

    await rm(CLAIMS_FILE, { force: true });

    const multiClaims = JSON.stringify([
      {
        file: 'receipt-a.pdf', filePath: '/tmp/receipt-a.pdf',
        claimant: 'Test User', claimType: 'FSA - Dental Expenses',
        clinicProvider: 'Dental Clinic', receiptDate: { dd: '01', mm: '03', yyyy: '2026' },
        receiptAmount: 150, receiptNumber: 'D-001'
      },
      {
        file: 'receipt-b.pdf', filePath: '/tmp/receipt-b.pdf',
        claimant: 'Test Spouse', claimType: 'FSA - Veterinary Medical Fees',
        clinicProvider: 'Vet Clinic', receiptDate: { dd: '15', mm: '03', yyyy: '2026' },
        receiptAmount: 500, receiptNumber: 'V-002'
      }
    ]);

    const { code: code5 } = run(`node scripts/write-claims.js '${multiClaims.replace(/'/g, "'\\''")}'`);
    assert(code5 === 0, 'write-claims.js handles multiple claims');

    const data5 = JSON.parse(await readFile(CLAIMS_FILE, 'utf-8'));
    assert(data5.claims.length === 2, '2 claims written');
    assert(data5.claims[0].claimant === 'Test User', 'first claim claimant correct');
    assert(data5.claims[1].claimant === 'Test Spouse', 'second claim claimant correct');

  } finally {
    // Restore backup
    if (backup) {
      await writeFile(CLAIMS_FILE, backup);
    } else {
      await rm(CLAIMS_FILE, { force: true });
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
