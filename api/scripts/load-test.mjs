/**
 * Dependency-free load / stress test for the Urban Furniture API.
 *
 * Ramps concurrency through stages against a read-heavy endpoint mix,
 * measuring throughput, latency percentiles and error rate, then reports
 * the max sustained load (last stage under the failure thresholds).
 *
 * Usage:
 *   node api/scripts/load-test.mjs [baseUrl]
 *
 * Env overrides:
 *   LOAD_BASE_URL   default http://localhost:5000
 *   LOAD_LOGIN_ID   default adminuf
 *   LOAD_PASSWORD   default Admin@12345
 *   LOAD_STAGES     comma list, default 5,10,25,50,100,200,400,800
 *   LOAD_STAGE_SECS default 12
 *
 * Reads only — it never posts/confirms anything, so it is safe to run
 * against the demo database.
 */

const BASE = process.argv[2] || process.env.LOAD_BASE_URL || 'http://localhost:5000';
const LOGIN = {
  login_id: process.env.LOAD_LOGIN_ID || 'adminuf',
  password: process.env.LOAD_PASSWORD || 'Admin@12345',
};

// Mirrors what a room full of people clicking around actually hits.
const ENDPOINTS = [
  '/api/dashboard/stats',
  '/api/dashboard/kpi',
  '/api/dashboard/trends',
  '/api/reports/profit-loss?from=2026-04-01&to=2027-03-31',
  '/api/reports/profit-loss?from=2026-09-01&to=2026-09-30',
  '/api/reports/balance-sheet?asOf=2026-09-30',
  '/api/invoices',
  '/api/vendor-bills',
  '/api/purchase-orders',
  '/api/verify',
  '/api/analytics/inventory',
  '/api/contacts',
];

const STAGES = (process.env.LOAD_STAGES || '5,10,25,50,100,200,400,800')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter(Boolean);
const STAGE_SECONDS = parseInt(process.env.LOAD_STAGE_SECS || '12', 10);
const WARMUP_SECONDS = 3;

// Once a stage crosses either, it is "over capacity" and the ramp stops.
const MAX_ERROR_RATE = 0.05; // >5% non-2xx
const MAX_P99_MS = 3000;     // p99 latency ceiling

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = await res.json();
  const token = body?.data?.token;
  if (!token) throw new Error('no token in login response');
  return token;
}

async function runStage(concurrency, token, seconds) {
  const authHeader = { Authorization: `Bearer ${token}` };
  const deadline = Date.now() + seconds * 1000;
  const latencies = [];
  let ok = 0;
  let failed = 0;
  let bytes = 0;
  let epIdx = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const path = ENDPOINTS[epIdx++ % ENDPOINTS.length];
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE}${path}`, { headers: authHeader });
        const buf = await res.arrayBuffer();
        bytes += buf.byteLength;
        latencies.push(performance.now() - t0);
        if (res.status >= 200 && res.status < 300) ok++;
        else failed++;
      } catch {
        latencies.push(performance.now() - t0);
        failed++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  const startedAt = performance.now();
  await Promise.all(workers);
  const elapsed = (performance.now() - startedAt) / 1000;

  const total = ok + failed;
  latencies.sort((a, b) => a - b);
  return {
    concurrency,
    total,
    ok,
    failed,
    errorRate: total ? failed / total : 0,
    rps: total / elapsed,
    mbps: bytes / 1024 / 1024 / elapsed,
    p50: pct(latencies, 50),
    p90: pct(latencies, 90),
    p99: pct(latencies, 99),
    max: latencies[latencies.length - 1] || 0,
  };
}

function fmtRow(r) {
  const f = (n, w) => String(n).padStart(w);
  return [
    f(r.concurrency, 5),
    f(r.total, 7),
    f(r.rps.toFixed(0), 7),
    f(r.mbps.toFixed(1), 6),
    f(r.p50.toFixed(0), 6),
    f(r.p90.toFixed(0), 6),
    f(r.p99.toFixed(0), 7),
    f(r.max.toFixed(0), 7),
    f((r.errorRate * 100).toFixed(1) + '%', 7),
  ].join(' | ');
}

(async () => {
  console.log(`\nTarget: ${BASE}`);
  console.log(`Mix: ${ENDPOINTS.length} read endpoints | stages: ${STAGES.join(', ')} | ${STAGE_SECONDS}s each\n`);

  const token = await login();

  process.stdout.write('warming up... ');
  await runStage(5, token, WARMUP_SECONDS);
  console.log('done\n');

  const widths = [5, 7, 7, 6, 6, 6, 7, 7, 7];
  const header = ['conc', 'reqs', 'rps', 'MB/s', 'p50ms', 'p90ms', 'p99ms', 'maxms', 'err']
    .map((h, i) => h.padStart(widths[i]))
    .join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length));

  const results = [];
  let maxSustained = null;
  for (const c of STAGES) {
    const r = await runStage(c, token, STAGE_SECONDS);
    results.push(r);
    console.log(fmtRow(r));
    const over = r.errorRate > MAX_ERROR_RATE || r.p99 > MAX_P99_MS;
    if (!over) {
      maxSustained = r;
    } else {
      console.log(
        `\n>>> Stage @${c} concurrent crossed a threshold ` +
          `(err ${(r.errorRate * 100).toFixed(1)}% / p99 ${r.p99.toFixed(0)}ms). Stopping ramp.`
      );
      break;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }

  console.log('\n===== SUMMARY =====');
  if (maxSustained) {
    console.log(
      `Max sustained load: ~${maxSustained.rps.toFixed(0)} req/s ` +
        `at ${maxSustained.concurrency} concurrent clients`
    );
    console.log(
      `  p50 ${maxSustained.p50.toFixed(0)}ms | p90 ${maxSustained.p90.toFixed(0)}ms | ` +
        `p99 ${maxSustained.p99.toFixed(0)}ms | errors ${(maxSustained.errorRate * 100).toFixed(2)}%`
    );
  } else {
    console.log('Even the lowest stage crossed a threshold — API is under stress or unreachable.');
  }
  const peak = results.reduce((a, b) => (b.rps > a.rps ? b : a), results[0]);
  console.log(
    `Peak throughput observed: ~${peak.rps.toFixed(0)} req/s @${peak.concurrency} concurrent ` +
      `(err ${(peak.errorRate * 100).toFixed(1)}%)`
  );
})().catch((e) => {
  console.error('load test failed:', e.message);
  process.exit(1);
});
