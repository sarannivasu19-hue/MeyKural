const https = require('https');

const BASE_URL = 'https://meykural.onrender.com';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runLiveTests() {
  console.log(`================================================================`);
  console.log(`🌐 MeyKural Live Deployment & Security Audit Suite`);
  console.log(`Target Host: ${BASE_URL}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  const results = [];

  function record(id, description, passed, details) {
    results.push({ id, description, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: [${id}] ${description} -> ${details}`);
  }

  // --- SECTION 1: PUBLIC / GUEST FEATURES ---
  console.log('--- SECTION 1: Guest / Publicly Accessible Features ---');

  // 1. Landing Page HTML & Tamil Title
  try {
    const res = await request('/');
    const ok = res.status === 200 && typeof res.raw === 'string' && (res.raw.includes('மெய்க்குறள்') || res.raw.includes('Meikkural'));
    record('PUB-1', 'Landing Page HTML & UTF-8 Tamil Support', ok, `HTTP ${res.status}, title verified`);
  } catch (e) {
    record('PUB-1', 'Landing Page HTML', false, e.message);
  }

  // 2. Health & Database readiness
  try {
    const res = await request('/api/health');
    const ok = res.status === 200 && res.data.database_ready && res.data.embeddings_ready;
    record('PUB-2', 'System Health (SQLite & Vector Embeddings)', ok, `HTTP ${res.status}, db_ready: ${res.data?.database_ready}`);
  } catch (e) {
    record('PUB-2', 'System Health', false, e.message);
  }

  // 3. Kural retrieval (Kural #1)
  try {
    const res = await request('/api/kurals/1');
    const ok = res.status === 200 && res.data.number === 1 && res.data.line1.includes('அகர முதல');
    record('PUB-3', 'Couplet Retrieval (Kural #1)', ok, `HTTP ${res.status}, line1: "${res.data?.line1}"`);
  } catch (e) {
    record('PUB-3', 'Couplet Retrieval', false, e.message);
  }

  // 4. Authentic Couplet Verification
  try {
    const res = await request('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { text: 'அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு' }
    });
    const ok = res.status === 200 && res.data.status === 'verified' && res.data.confidence_percent === 100;
    record('PUB-4', 'Quotation Verifier (Authentic Match)', ok, `status: "${res.data?.status}", confidence: ${res.data?.confidence_percent}%`);
  } catch (e) {
    record('PUB-4', 'Quotation Verifier', false, e.message);
  }

  // 5. Hallucinated Couplet Shield
  try {
    const res = await request('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { text: 'கணினி உலகுக்கு வழிகாட்டும் தமிழ் நெறி என்றும் வாழியவே' }
    });
    const ok = res.status === 200 && res.data.status === 'not_found' && res.data.seal === 'red_cracked_seal';
    record('PUB-5', 'AI Hallucination Shield (Fake Rejection)', ok, `status: "${res.data?.status}", seal: "${res.data?.seal}"`);
  } catch (e) {
    record('PUB-5', 'AI Hallucination Shield', false, e.message);
  }

  // 6. Chapters / Athikaram list
  try {
    const res = await request('/api/adhikarams');
    const ok = res.status === 200 && Array.isArray(res.data) && res.data.length === 133;
    record('PUB-6', 'Athikaram Catalog (133 Chapters)', ok, `HTTP ${res.status}, count: ${res.data?.length}`);
  } catch (e) {
    record('PUB-6', 'Athikaram Catalog', false, e.message);
  }

  // 7. Offline PWA Bundle
  try {
    const res = await request('/data/thirukurals_bundle.json');
    const ok = res.status === 200 && res.data?.kurals?.length === 1330;
    record('PUB-7', 'PWA Offline Cache Bundle (1,330 Kurals)', ok, `HTTP ${res.status}, total couplets: ${res.data?.kurals?.length}`);
  } catch (e) {
    record('PUB-7', 'PWA Offline Cache Bundle', false, e.message);
  }

  // --- SECTION 2: PROTECTED ADMIN ROUTES (UNAUTHENTICATED ACCESS BLOCKS) ---
  console.log('\n--- SECTION 2: Protected Admin Routes (Guest Access Blocked) ---');

  // 8. Unauthenticated /api/admin/stats
  try {
    const res = await request('/api/admin/stats');
    const ok = res.status === 401;
    record('SEC-1', 'Protected Route /api/admin/stats blocks unauthenticated guest', ok, `HTTP ${res.status} (expected 401)`);
  } catch (e) {
    record('SEC-1', 'Protected Route /api/admin/stats', false, e.message);
  }

  // 9. Unauthenticated /api/admin/logs
  try {
    const res = await request('/api/admin/logs');
    const ok = res.status === 401;
    record('SEC-2', 'Protected Route /api/admin/logs blocks unauthenticated guest', ok, `HTTP ${res.status} (expected 401)`);
  } catch (e) {
    record('SEC-2', 'Protected Route /api/admin/logs', false, e.message);
  }

  // 10. Unauthenticated /api/admin/settings
  try {
    const res = await request('/api/admin/settings');
    const ok = res.status === 401;
    record('SEC-3', 'Protected Route /api/admin/settings blocks unauthenticated guest', ok, `HTTP ${res.status} (expected 401)`);
  } catch (e) {
    record('SEC-3', 'Protected Route /api/admin/settings', false, e.message);
  }

  // 11. Unauthenticated /api/admin/users
  try {
    const res = await request('/api/admin/users');
    const ok = res.status === 401;
    record('SEC-4', 'Protected Route /api/admin/users blocks unauthenticated guest', ok, `HTTP ${res.status} (expected 401)`);
  } catch (e) {
    record('SEC-4', 'Protected Route /api/admin/users', false, e.message);
  }

  // 12. Unauthenticated destructive action (/api/reports/clear-demo)
  try {
    const res = await request('/api/reports/clear-demo', { method: 'POST' });
    const ok = res.status === 401;
    record('SEC-5', 'Destructive Action /api/reports/clear-demo blocks unauthenticated guest', ok, `HTTP ${res.status} (expected 401)`);
  } catch (e) {
    record('SEC-5', 'Destructive Action /api/reports/clear-demo', false, e.message);
  }

  // --- SECTION 3: AUTHENTICATION INTEGRITY ---
  console.log('\n--- SECTION 3: Authentication & Security Integrity ---');

  // 13. Admin Login rejects invalid password
  try {
    const res = await request('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'admin', password: 'DefinitelyWrongPassword!99' }
    });
    const ok = res.status === 401 && res.data?.error?.includes('Invalid admin credentials');
    record('AUTH-1', 'Admin Login rejects wrong password', ok, `HTTP ${res.status}, error: "${res.data?.error}"`);
  } catch (e) {
    record('AUTH-1', 'Admin Login rejects wrong password', false, e.message);
  }

  // 14. User Login rejects empty inputs
  try {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    });
    const ok = res.status === 400;
    record('AUTH-2', 'User Login validates required fields', ok, `HTTP ${res.status}, error: "${res.data?.error}"`);
  } catch (e) {
    record('AUTH-2', 'User Login validates required fields', false, e.message);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`Live Audit Finished: ${passedCount} Passed, ${failedCount} Failed (Total ${results.length})`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runLiveTests();
