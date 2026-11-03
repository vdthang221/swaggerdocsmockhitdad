const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { reset, ID } = require('../src/db');

let server, base;
test.before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
test.beforeEach(() => reset());

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

test('swagger.json có đúng 2 tag và 22 operation', async () => {
  const { data } = await call('GET', '/swagger.json');
  assert.deepEqual(data.tags.map((t) => t.name), ['User', 'Payment']);
  const ops = Object.values(data.paths).flatMap((p) => Object.keys(p));
  assert.equal(ops.length, 22);
});

test('auth: thiếu/sai token, chưa duyệt', async () => {
  assert.equal((await call('GET', '/api/users/members')).status, 401);
  assert.equal((await call('GET', '/api/users/members', { token: 'bad' })).status, 401);
  const r = await call('GET', '/api/users/members', { token: 'pending-token' });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'MEMBERSHIP_PENDING');
});

test('USER: members (admin thấy email, member thì không)', async () => {
  const a = await call('GET', '/api/users/members', { token: 'admin-token' });
  assert.equal(a.status, 200); assert.equal(a.data.members.length, 6); assert.ok(a.data.members[0].email);
  const m = await call('GET', '/api/users/members', { token: 'member-token' });
  assert.equal(m.data.members[0].email, undefined);
});

test('USER: membership requests list/count/review', async () => {
  assert.equal((await call('GET', '/api/users/membership-requests/count', { token: 'admin-token' })).data.count, 3);
  assert.equal((await call('GET', '/api/users/membership-requests', { token: 'member-token' })).status, 403);
  const list = await call('GET', '/api/users/membership-requests', { token: 'admin-token' });
  assert.equal(list.data.requests.length, 3);
  assert.equal((await call('PUT', `/api/users/membership-requests/${ID.pending1}`, { token: 'admin-token', body: { decision: 'X' } })).status, 400);
  const ok = await call('PUT', `/api/users/membership-requests/${ID.pending1}`, { token: 'admin-token', body: { decision: 'APPROVED' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('PUT', `/api/users/membership-requests/${ID.pending1}`, { token: 'admin-token', body: { decision: 'APPROVED' } })).status, 409);
  assert.equal((await call('GET', '/api/users/membership-requests/count', { token: 'admin-token' })).data.count, 2);
});

test('USER: tier & goalkeeper', async () => {
  const t = await call('PUT', `/api/users/${ID.binh}/tier`, { token: 'admin-token', body: { tier: 'A' } });
  assert.equal(t.data.user.tier, 'A');
  assert.equal((await call('PUT', `/api/users/${ID.binh}/tier`, { token: 'admin-token', body: { tier: null } })).data.user.tier, null);
  assert.equal((await call('PUT', `/api/users/nope/tier`, { token: 'admin-token', body: {} })).status, 404);
  assert.equal((await call('PUT', `/api/users/${ID.binh}/tier`, { token: 'member-token', body: {} })).status, 403);
  const g = await call('PUT', `/api/users/${ID.binh}/goalkeeper`, { token: 'admin-token', body: { isGoalkeeper: true } });
  assert.equal(g.data.user.isGoalkeeper, true);
});

test('USER: profile validate + update', async () => {
  assert.equal((await call('PUT', '/api/users/profile', { token: 'member-token', body: { displayName: '' } })).status, 400);
  assert.equal((await call('PUT', '/api/users/profile', { token: 'member-token', body: { displayName: 'A', phone: '123' } })).status, 400);
  const r = await call('PUT', '/api/users/profile', { token: 'member-token', body: { displayName: 'An Pro', phone: '0901 234 567', bankInfo: 'MB', isGoalkeeper: true } });
  assert.equal(r.status, 200); assert.equal(r.data.user.phone, '0901234567'); assert.equal(r.data.user.displayName, 'An Pro');
});

test('USER: change-password', async () => {
  const p = '/api/users/change-password';
  assert.equal((await call('PUT', p, { token: 'member-token', body: { currentPassword: 'x', newPassword: '123' } })).status, 400);
  assert.equal((await call('PUT', p, { token: 'member-token', body: { currentPassword: 'wrong', newPassword: 'NewSecret@1' } })).status, 400);
  assert.equal((await call('PUT', p, { token: 'member-token', body: { currentPassword: 'OldPassword@123', newPassword: 'NewSecret@1' } })).status, 200);
  assert.equal((await call('PUT', p, { token: 'member-token', body: { currentPassword: 'OldPassword@123', newPassword: 'Another@1' } })).status, 400);
});

test('USER: avatar & qr-code', async () => {
  const img = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal((await call('PUT', '/api/users/avatar', { token: 'member-token', body: { avatar: 'http://x' } })).status, 400);
  assert.equal((await call('PUT', '/api/users/avatar', { token: 'member-token', body: { avatar: img } })).status, 200);
  assert.equal((await call('DELETE', '/api/users/avatar', { token: 'member-token' })).status, 200);
  assert.equal((await call('PUT', '/api/users/qr-code', { token: 'member-token', body: { qrCodeImage: img } })).status, 200);
  assert.equal((await call('GET', `/api/users/${ID.an}/qr-code`, { token: 'admin-token' })).data.qrCodeImage, img);
  assert.equal((await call('DELETE', '/api/users/qr-code', { token: 'member-token' })).status, 200);
  assert.equal((await call('GET', `/api/users/${ID.an}/qr-code`, { token: 'admin-token' })).data.qrCodeImage, null);
  assert.equal((await call('GET', `/api/users/nope/qr-code`, { token: 'admin-token' })).status, 404);
  const big = 'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 10).toString('base64');
  assert.equal((await call('PUT', '/api/users/avatar', { token: 'member-token', body: { avatar: big } })).status, 400);
});

test('USER: export excel', async () => {
  const r = await call('GET', '/api/users/export-excel', { token: 'admin-token' });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /spreadsheetml/);
  assert.equal(r.data.subarray(0, 2).toString(), 'PK');
  assert.equal((await call('GET', '/api/users/export-excel', { token: 'member-token' })).status, 403);
});

test('USER: delete member', async () => {
  assert.equal((await call('DELETE', `/api/users/${ID.admin}`, { token: 'admin-token' })).status, 400);
  assert.equal((await call('DELETE', `/api/users/nope`, { token: 'admin-token' })).status, 404);
  assert.equal((await call('DELETE', `/api/users/${ID.em}`, { token: 'member-token' })).status, 403);
  const r = await call('DELETE', `/api/users/${ID.em}`, { token: 'admin-token' });
  assert.equal(r.status, 200); assert.match(r.data.message, /Hoàng Văn Em/);
  const s = await call('GET', `/api/payments/session/${ID.sessionBooked}`, { token: 'admin-token' });
  assert.equal(s.data.summary.total, 4);
});

test('PAYMENT: session summary', async () => {
  const r = await call('GET', `/api/payments/session/${ID.sessionBooked}`, { token: 'member-token' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.summary, { totalCost: 500000, pending: 2, paid: 1, confirmed: 2, total: 5 });
  assert.equal(r.data.session.payer.displayName, 'Nguyễn Hoàng Phúc');
  assert.equal(r.data.payments[0].status, 'PENDING');
  assert.equal((await call('GET', '/api/payments/session/nope', { token: 'member-token' })).status, 404);
});

test('PAYMENT: mark-paid & confirm & auto-complete session', async () => {
  assert.equal((await call('PUT', `/api/payments/${ID.payAn}/mark-paid`, { token: 'member2-token' })).status, 403);
  assert.equal((await call('PUT', `/api/payments/${ID.payAn}/mark-paid`, { token: 'member-token' })).data.payment.status, 'PAID');
  assert.equal((await call('PUT', `/api/payments/${ID.payAn}/confirm`, { token: 'member-token' })).status, 403);
  assert.equal((await call('PUT', `/api/payments/${ID.payAn}/confirm`, { token: 'admin-token' })).data.sessionCompleted, false);
  await call('PUT', `/api/payments/${ID.payBinh}/confirm`, { token: 'admin-token' });
  const last = await call('PUT', `/api/payments/${ID.payCuong}/confirm`, { token: 'admin-token' });
  assert.equal(last.data.sessionCompleted, true);
  assert.equal((await call('GET', `/api/payments/session/${ID.sessionBooked}`, { token: 'admin-token' })).data.session.status, 'COMPLETED');
  assert.equal((await call('PUT', `/api/payments/nope/confirm`, { token: 'admin-token' })).status, 404);
});

test('PAYMENT: payos-link -> status -> webhook -> CONFIRMED', async () => {
  const link = await call('POST', `/api/payments/${ID.payAn}/payos-link`, { token: 'member-token' });
  assert.equal(link.status, 200);
  assert.ok(link.data.orderCode && link.data.checkoutUrl && link.data.qrCode);
  assert.equal(link.data.amount, 100000);
  const again = await call('POST', `/api/payments/${ID.payAn}/payos-link`, { token: 'member-token' });
  assert.equal(again.data.orderCode, link.data.orderCode); // tái sử dụng
  assert.equal((await call('POST', `/api/payments/${ID.payAn}/payos-link`, { token: 'member2-token' })).status, 403);
  assert.equal((await call('POST', `/api/payments/${ID.payDung}/payos-link`, { token: 'admin-token' })).status, 400);

  const st = await call('GET', `/api/payments/${ID.payAn}/payos-status`, { token: 'member-token' });
  assert.equal(st.data.isPaid, false); assert.equal(st.data.payosStatus, 'PENDING');

  const hook = { code: '00', desc: 'success', signature: 'abc', data: { orderCode: link.data.orderCode, amount: 100000, code: '00' } };
  assert.equal((await call('POST', '/api/payments/payos-webhook', { body: { ...hook, signature: 'invalid' } })).status, 400);
  assert.equal((await call('POST', '/api/payments/payos-webhook', { body: hook })).data.success, true); // public, không cần token
  const st2 = await call('GET', `/api/payments/${ID.payAn}/payos-status`, { token: 'member-token' });
  assert.equal(st2.data.status, 'CONFIRMED'); assert.equal(st2.data.isPaid, true);
});

test('PAYMENT: confirm-webhook chỉ admin', async () => {
  assert.equal((await call('POST', '/api/payments/payos-confirm-webhook', { token: 'member-token', body: {} })).status, 403);
  const r = await call('POST', '/api/payments/payos-confirm-webhook', { token: 'admin-token', body: {} });
  assert.equal(r.status, 200); assert.match(r.data.webhookUrl, /\/api\/payments\/payos-webhook$/);
});

test('mock reset + health', async () => {
  await call('PUT', `/api/users/${ID.binh}/tier`, { token: 'admin-token', body: { tier: 'Z' } });
  await call('POST', '/mock/reset');
  const m = await call('GET', '/api/users/members', { token: 'admin-token' });
  assert.equal(m.data.members.find((u) => u.id === ID.binh).tier, 'C');
  assert.equal((await call('GET', '/health')).data.status, 'ok');
});
