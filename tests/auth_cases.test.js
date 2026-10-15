/**
 * MeyKural - Authentication Separation Test Suite
 * Verifies all 7 required security conditions.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function runAuthTests() {
  console.log(`🧪 Running MeyKural Auth Security Test Suite against ${BASE_URL}...\n`);
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

  // Helper fetch
  async function post(endpoint, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function get(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // Case 1: admin credentials (admin / 1906) on user form (POST /api/auth/login) -> REJECTED
  {
    const res = await post('/api/auth/login', { username: 'admin', password: 'ADMIN_TEST_PASSWORD_OR_1906' });
    const resReal = await post('/api/auth/login', { username: 'admin', password: '1906' });
    assert(
      (resReal.status === 401 || resReal.status === 404) && !resReal.data.token,
      'Case 1: Admin credentials on user login endpoint rejected with 401 without granting token'
    );
  }

  // Register a legitimate test user for subsequent cases
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'StrongPassword!123';

  // Case 7: Register with reserved usernames "admin", "Admin", "administrator" -> REJECTED
  {
    const resAdmin = await post('/api/auth/register', { username: 'admin', password: 'password123' });
    const resAdminCap = await post('/api/auth/register', { username: '  Admin  ', password: 'password123' });
    const resAdminStrator = await post('/api/auth/register', { username: 'administrator', password: 'password123' });

    assert(
      resAdmin.status === 400 && resAdminCap.status === 400 && resAdminStrator.status === 400,
      'Case 7: Registration with reserved usernames (admin, Admin, administrator) rejected with 400'
    );
  }

  // Case 4: Register new user -> works
  let userToken = null;
  {
    const res = await post('/api/auth/register', { username: testUsername, password: testPassword });
    assert(
      res.status === 201 && res.data.success && res.data.user && res.data.user.username === testUsername,
      `Case 4: Register new user (${testUsername}) succeeds with 201 and user profile`
    );
  }

  // Case 5: New user login -> works, receives user token
  {
    const res = await post('/api/auth/login', { username: testUsername, password: testPassword });
    userToken = res.data.token;
    assert(
      res.status === 200 && userToken && res.data.user.role === 'user',
      'Case 5: User login with newly registered credentials returns 200 and user JWT token'
    );
  }

  // Case 2: User credentials on admin form (POST /api/auth/admin-login) -> REJECTED
  {
    const res = await post('/api/auth/admin-login', { username: testUsername, password: testPassword });
    assert(
      res.status === 401 && !res.data.token,
      'Case 2: User credentials on admin login endpoint rejected with 401'
    );
  }

  // Case 3: Non-existent user on user form -> REJECTED
  {
    const res = await post('/api/auth/login', { username: 'ghost_user_does_not_exist_9999', password: 'anyPassword123' });
    assert(
      res.status === 401 && !res.data.token,
      'Case 3: Non-existent user on user login rejected with 401'
    );
  }

  // Case 6: User token cannot access /api/admin/* endpoints -> REJECTED (403)
  {
    const resStats = await get('/api/admin/stats', userToken);
    const resSettings = await get('/api/admin/settings', userToken);
    const resLogs = await get('/api/admin/logs', userToken);
    assert(
      resStats.status === 403 &&
      resSettings.status === 403 &&
      resLogs.status === 403,
      'Case 6: User token accessing /api/admin/* endpoints blocked with 403 Forbidden'
    );
  }

  console.log(`\n==================================================`);
  console.log(`Auth Security Results: ${passed} Passed, ${failed} Failed.`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runAuthTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
