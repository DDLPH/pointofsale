import assert from 'node:assert/strict';
const root = process.env.TEST_BASE_URL || 'http://localhost:5173';
async function request(path, body, cookie = '', origin = root) {
  const response = await fetch(root + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
const path = '/api/reports/sheets';
assert.equal((await request(path, { date: '2026-09-11' })).status, 401);
const admin = await request('/api/auth', { action: 'login', username: 'Admin1', password: process.env.TEST_ADMIN_PASSWORD });
const staff = await request('/api/auth', { action: 'login', username: 'P01', password: process.env.TEST_STAFF_PASSWORD });
assert.equal(admin.status, 200); assert.equal(staff.status, 200);
try {
  assert.equal((await request(path, { date: '2026-09-11' }, staff.cookie)).status, 403);
  assert.equal((await request(path, { date: '2026-09-11' }, admin.cookie, 'https://untrusted.example')).status, 403);
  assert.equal((await request(path, { date: '2026-09-11' }, admin.cookie, '')).status, 403);
  assert.equal((await request(path, { date: '2026-02-30' }, admin.cookie)).status, 400);
  assert.equal((await request(path, {}, admin.cookie)).status, 400);
  // Local environment deliberately has no real webhook configured.
  assert.equal((await request(path, { date: '2026-09-11' }, admin.cookie)).status, 503);
  console.log('PASS: authentication, admin role, CSRF, calendar validation, missing configuration');
} finally {
  await request('/api/auth', { action: 'logout' }, admin.cookie);
  await request('/api/auth', { action: 'logout' }, staff.cookie);
}
