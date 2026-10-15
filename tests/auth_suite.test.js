/**
 * MeyKural - Comprehensive Authentication & Security Suite
 * Tests all required authentication scenarios:
 * 1. Wrong password (admin) -> 401
 * 2. Wrong password (user) -> 401
 * 3. Random non-existent username -> 401
 * 4. Empty fields -> 400
 * 5. SQL-injection strings -> 401 (gracefully handled)
 * 6. Admin credentials on user login -> 401
 * 7. User credentials on admin login -> 401
 * 8. Unregistered user -> 401
 * 9. Register then login works -> 201 on register, 200 on login
 * 10. Admin login works -> 200
 * 11. No cookie/token on protected API (/api/admin/stats) -> 401
 * 12. Tampered token on protected API -> 401
 * 13. User token on admin API (/api/admin/stats) -> 403
 * 14. Locked-out account (after 5 consecutive failures) -> 429
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function runTestSuite() {
  console.log(`\n================================================================`);
  console.log(`🔐 MeyKural Auth Security Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`================================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  let ipCounter = 10;
  async function post(endpoint, body, token = null, ip = null) {
    const clientIp = ip || `10.0.1.${++ipCounter}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': clientIp
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: res.headers };
  }

  async function get(endpoint, token = null, ip = null) {
    const clientIp = ip || `10.0.1.${++ipCounter}`;
    const headers = { 'X-Forwarded-For': clientIp };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Empty fields -> 400
  {
    const res1 = await post('/api/auth/login', {});
    const res2 = await post('/api/auth/admin-login', { username: 'admin' });
    const res3 = await post('/api/auth/register', { username: '' });
    assert(
      res1.status === 400 && res2.status === 400 && res3.status === 400,
      '1. Empty or missing fields rejected with HTTP 400'
    );
  }

  // 2. SQL injection attempt in username or password -> 401
  {
    const res = await post('/api/auth/login', { username: "' OR '1'='1' --", password: "' OR 1=1" });
    assert(
      res.status === 401 && !res.data.token,
      '2. SQL injection payload safely rejected with HTTP 401 (no leak or bypass)'
    );
  }

  // 3. Random non-existent username -> 401
  {
    const res = await post('/api/auth/login', { username: `ghost_${Date.now()}`, password: 'password123' });
    assert(
      res.status === 401 && !res.data.token,
      '3. Random non-existent username rejected with HTTP 401'
    );
  }

  // 4. Admin credentials on User login endpoint -> 401
  {
    const res = await post('/api/auth/login', { username: 'admin', password: '1906' });
    assert(
      res.status === 401 && !res.data.token,
      '4. Admin credentials on user login endpoint rejected with HTTP 401'
    );
  }

  // 5. Unregistered user -> 401
  {
    const res = await post('/api/auth/login', { username: 'unregistered_patron_xyz', password: 'SecretPassword99!' });
    assert(
      res.status === 401 && !res.data.token,
      '5. Unregistered user rejected with HTTP 401'
    );
  }

  // 6. Register a new user -> works (201)
  const testUser = `patron_${Date.now()}`;
  const testPass = 'Tirukkural@2026!';
  let userToken = null;

  {
    const res = await post('/api/auth/register', { username: testUser, password: testPass, email: `${testUser}@test.local` });
    assert(
      res.status === 201 && res.data.success && res.data.user && res.data.user.username === testUser,
      `6. Registration for '${testUser}' succeeds with HTTP 201`
    );
  }

  // 7. Wrong password for registered user -> 401
  {
    const res = await post('/api/auth/login', { username: testUser, password: 'WrongPassword999!' });
    assert(
      res.status === 401 && !res.data.token,
      '7. Wrong password for registered user rejected with HTTP 401'
    );
  }

  // 8. Register then login works -> 200
  {
    const res = await post('/api/auth/login', { username: testUser, password: testPass });
    userToken = res.data.token;
    assert(
      res.status === 200 && userToken && res.data.user && res.data.user.role === 'user',
      '8. Registered user login succeeds with HTTP 200, JWT token, and role="user"'
    );
  }

  // 9. User credentials on admin login endpoint -> 401
  {
    const res = await post('/api/auth/admin-login', { username: testUser, password: testPass });
    assert(
      res.status === 401 && !res.data.token,
      '9. User credentials on admin login endpoint rejected with HTTP 401'
    );
  }

  // 10. Wrong password for admin -> 401
  {
    const res = await post('/api/auth/admin-login', { username: 'admin', password: 'wrong_admin_pass' });
    assert(
      res.status === 401 && !res.data.token,
      '10. Wrong password for admin rejected with HTTP 401'
    );
  }

  // 11. Admin login works -> 200
  let adminToken = null;
  {
    const res = await post('/api/auth/admin-login', { username: 'admin', password: '1906' });
    adminToken = res.data.token;
    assert(
      res.status === 200 && adminToken && res.data.user && res.data.user.role === 'admin',
      '11. Admin login with seeded credentials succeeds with HTTP 200 and role="admin"'
    );
  }

  // 12. No cookie / token on protected admin API -> 401
  {
    const res = await get('/api/admin/stats');
    assert(
      res.status === 401,
      '12. Unauthenticated request to /api/admin/stats rejected with HTTP 401'
    );
  }

  // 13. Tampered token on protected API -> 401
  {
    const tampered = adminToken ? adminToken.slice(0, -6) + 'xxxxxx' : 'invalid.fake.token';
    const res = await get('/api/admin/stats', tampered);
    assert(
      res.status === 401,
      '13. Tampered or invalid JWT signature rejected with HTTP 401'
    );
  }

  // 14. User token on admin API -> 403 Forbidden
  {
    const res = await get('/api/admin/stats', userToken);
    assert(
      res.status === 403,
      '14. Valid user token accessing /api/admin/stats blocked with HTTP 403 Forbidden'
    );
  }

  // 15. Admin token accessing admin API -> 200 OK
  {
    const res = await get('/api/admin/stats', adminToken);
    assert(
      res.status === 200 && (res.data.totalChecks !== undefined || res.data.total_checks !== undefined),
      '15. Admin token successfully accesses /api/admin/stats (HTTP 200)'
    );
  }

  // 16. Account lockout after 5 consecutive failed attempts -> 429
  {
    const victimUser = `lockout_victim_${Date.now()}`;
    const victimIp = '10.99.99.99';
    await post('/api/auth/register', { username: victimUser, password: 'InitialPassword123' }, null, victimIp);

    // 5 consecutive failed attempts
    for (let i = 0; i < 5; i++) {
      await post('/api/auth/login', { username: victimUser, password: 'BadPasswordAttempt' }, null, victimIp);
    }

    // 6th attempt must be locked out
    const lockedRes = await post('/api/auth/login', { username: victimUser, password: 'BadPasswordAttempt' }, null, victimIp);
    assert(
      lockedRes.status === 429,
      '16. Account lockout enforced after 5 failures: 6th attempt returns HTTP 429'
    );
  }

  console.log(`\n================================================================`);
  console.log(`Auth Security Results: ${passed} Passed, ${failed} Failed.`);
  console.log(`================================================================\n`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
