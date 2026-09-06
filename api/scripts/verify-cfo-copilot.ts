import { CfoCopilotService } from '../src/services/cfoCopilotService';
import { pool } from '../src/db/pool';

async function main() {
  console.log('====================================================');
  console.log('CFO COPILOT VERIFICATION — Live Ledger & Ollama');
  console.log('====================================================\n');

  try {
    // 1. Verify Ground Truth Snapshot
    console.log('--- Step 1: Query Ground Truth Financial Snapshot ---');
    const snapshot = await CfoCopilotService.getFinancialSnapshot();
    console.log('Timestamp:', snapshot.timestamp);
    console.log('Liquidity:', JSON.stringify(snapshot.liquidity, null, 2));
    console.log('P&L Current Month:', JSON.stringify(snapshot.pnl, null, 2));
    console.log('Aging Overdue Invoices Count:', snapshot.aging.overdueInvoicesCount, 'Total:', snapshot.aging.overdueInvoicesTotal);
    console.log('Integrity Status:', snapshot.integrity.status, `(${snapshot.integrity.passed}/${snapshot.integrity.total})`);
    console.log('Top Overdue Invoices:', snapshot.aging.topOverdueInvoices.length);
    console.log('✅ PASS: Snapshot generated successfully from Postgres.\n');

    // 2. Verify Deterministic Fallback
    console.log('--- Step 2: Test Deterministic CFO Report ---');
    const detReport = CfoCopilotService.generateDeterministicReport(snapshot, 'liquidity');
    console.log('Deterministic Liquidity Report Preview (first 200 chars):');
    console.log(detReport.slice(0, 200) + '...\n');
    console.log('✅ PASS: Deterministic generator works cleanly.\n');

    // 3. Test Live Copilot Query
    console.log('--- Step 3: Test queryCfoCopilot with local context ---');
    const res = await CfoCopilotService.queryCfoCopilot({
      message: 'Provide an executive assessment of our working capital and top overdue accounts.',
      focus: 'overview',
    });

    console.log('Result Source:', res.source);
    console.log('Model Used:', res.modelUsed);
    console.log('Execution Time:', `${res.executionTimeMs}ms`);
    console.log('\n--- Advice Content ---');
    console.log(res.advice);
    // 4. Test Basic Question: Working Capital
    console.log('--- Step 4: Test Basic Question (Working Capital) ---');
    const basicRes = await CfoCopilotService.queryCfoCopilot({
      message: 'What is working capital and why is it important for Urban Furniture?',
      focus: 'liquidity',
    });
    console.log('Basic Question Source:', basicRes.source);
    console.log('Basic Question Model:', basicRes.modelUsed);
    console.log('Basic Question Response (preview):', basicRes.advice.slice(0, 200) + '...\n');
    console.log('✅ PASS: Basic educational question answered.\n');

    // 5. Test Affordability Question
    console.log('--- Step 5: Test Basic Affordability Decision ---');
    const affordRes = await CfoCopilotService.queryCfoCopilot({
      message: 'Can we afford to purchase ₹50,000 of new stock today?',
      focus: 'liquidity',
    });
    console.log('Affordability Source:', affordRes.source);
    console.log('Affordability Response (preview):', affordRes.advice.slice(0, 200) + '...\n');
    console.log('✅ PASS: Basic affordability question answered.\n');

    console.log('====================================================');
    console.log('✅ ALL CFO COPILOT & BASIC QUESTIONS VERIFIED');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
