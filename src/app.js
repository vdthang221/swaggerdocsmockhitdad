const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const swaggerUi = require('swagger-ui-express');
const ExcelJS = require('exceljs');
const { db, reset, TOKENS, ID } = require('./db');
const { buildSpec } = require('./openapi');

const VALID_IMG = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/jpg;base64,'];
const MAX_IMG = 2 * 1024 * 1024;

const findUser = (id) => db.users.find((u) => u.id === id);
const findPayment = (id) => db.payments.find((p) => p.id === id);
const findSession = (id) => db.sessions.find((s) => s.id === id);

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // ---------- Swagger UI ----------
  const spec = buildSpec();
  app.get(['/swagger.json', '/openapi.json'], (req, res) => res.json(spec));
  const uiOptions = {
    customSiteTitle: 'CSE PunchDad – API Docs (User & Payment)',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      defaultModelsExpandDepth: -1,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      url: '/swagger.json',
    },
    customJsStr: `
      window.addEventListener('load', function () {
        var t = setInterval(function () {
          if (window.ui && window.ui.preauthorizeApiKey) {
            clearInterval(t);
            try { window.ui.preauthorizeApiKey('BearerAuth', 'admin-token'); } catch (e) {}
          }
        }, 200);
        setTimeout(function () { clearInterval(t); }, 8000);
      });`,
  };
  app.use('/api-docs', swaggerUi.serveFiles(null, uiOptions), swaggerUi.setup(null, uiOptions));
  app.get('/', (req, res) => res.redirect('/api-docs'));
  app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'mock-in-memory-db' }));

  // ---------- Mock utilities (không nằm trong Swagger) ----------
  app.post('/mock/reset', (req, res) => { reset(); res.json({ message: 'Đã reset database ảo về dữ liệu mẫu' }); });
  app.get('/mock/tokens', (req, res) => res.json({ tokens: TOKENS, ids: ID }));

  // ---------- Auth (mô phỏng JWT bằng token tĩnh) ----------
  const authenticate = (req, res, next) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
    const userId = TOKENS[h.split(' ')[1]];
    const user = userId && findUser(userId);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (user.membershipStatus === 'REJECTED') return res.status(403).json({ code: 'MEMBERSHIP_REJECTED', error: 'Yêu cầu tham gia CLB đã bị từ chối. Vui lòng liên hệ admin.' });
    if (user.membershipStatus !== 'APPROVED') return res.status(403).json({ code: 'MEMBERSHIP_PENDING', error: 'Tài khoản đang chờ admin duyệt. Bạn chỉ có thể vào CLB sau khi được chấp thuận.' });
    req.user = user;
    next();
  };
  const requireAdmin = (req, res, next) =>
    req.user.role === 'ADMIN' ? next() : res.status(403).json({ error: 'Admin access required' });

  const publicUser = (u) => ({
    id: u.id, username: u.username, email: u.email, displayName: u.displayName, role: u.role,
    phone: u.phone, bankInfo: u.bankInfo, avatar: u.avatar, tier: u.tier, isGoalkeeper: u.isGoalkeeper,
  });
  const attendCount = (u) => db.attendance[u.id] || 0;
  const sortMembers = (a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName, 'vi') : a.role.localeCompare(b.role));
  const approved = () => db.users.filter((u) => u.membershipStatus === 'APPROVED').sort(sortMembers);
  const pendingList = () => db.users.filter((u) => u.membershipStatus === 'PENDING' && u.role === 'MEMBER').sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const checkImage = (value, emptyMsg, tooBigMsg) => {
    if (!value) return emptyMsg;
    if (!VALID_IMG.some((p) => String(value).startsWith(p))) return 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP';
    if (Buffer.from(String(value).split(',')[1] || '', 'base64').length > MAX_IMG) return tooBigMsg;
    return null;
  };

  // =====================================================
  //                    USER COLLECTION
  // =====================================================
  const users = express.Router();
  users.use(authenticate);

  users.get('/members', (req, res) => {
    const isAdmin = req.user.role === 'ADMIN';
    res.json({
      members: approved().map((u) => ({
        id: u.id, username: u.username, ...(isAdmin ? { email: u.email } : {}),
        displayName: u.displayName, role: u.role, tier: u.tier, isGoalkeeper: u.isGoalkeeper,
        phone: u.phone, avatar: u.avatar, createdAt: u.createdAt, _count: { votes: attendCount(u) },
      })),
    });
  });

  users.get('/export-excel', requireAdmin, async (req, res, next) => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = req.user.displayName;
      wb.created = new Date();
      const s1 = wb.addWorksheet('Thành viên chính thức');
      s1.columns = [
        { header: 'STT', key: 'i', width: 6 }, { header: 'Họ tên', key: 'displayName', width: 24 },
        { header: 'Username', key: 'username', width: 18 }, { header: 'Email', key: 'email', width: 28 },
        { header: 'SĐT', key: 'phone', width: 14 }, { header: 'Vai trò', key: 'role', width: 10 },
        { header: 'Tier', key: 'tier', width: 8 }, { header: 'Thủ môn', key: 'gk', width: 10 },
        { header: 'Số trận', key: 'n', width: 10 }, { header: 'Ngân hàng', key: 'bankInfo', width: 40 },
      ];
      approved().forEach((u, i) => s1.addRow({ i: i + 1, ...u, gk: u.isGoalkeeper ? 'Có' : '', n: attendCount(u) }));
      const s2 = wb.addWorksheet('Đơn chờ duyệt');
      s2.columns = [
        { header: 'STT', key: 'i', width: 6 }, { header: 'Họ tên', key: 'displayName', width: 24 },
        { header: 'Username', key: 'username', width: 18 }, { header: 'Email', key: 'email', width: 28 },
        { header: 'SĐT', key: 'phone', width: 14 }, { header: 'Ngày đăng ký', key: 'createdAt', width: 26 },
      ];
      pendingList().forEach((u, i) => s2.addRow({ i: i + 1, ...u }));
      [s1, s2].forEach((s) => { s.getRow(1).font = { bold: true }; });

      const buf = await wb.xlsx.writeBuffer();
      const d = new Date(); const p = (n) => String(n).padStart(2, '0');
      const name = `Danh_sach_thanh_vien_CSE_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.send(Buffer.from(buf));
    } catch (e) { next(e); }
  });

  users.get('/membership-requests', requireAdmin, (req, res) => {
    res.json({
      requests: pendingList().map((u) => ({
        id: u.id, username: u.username, displayName: u.displayName, email: u.email,
        phone: u.phone, createdAt: u.createdAt, membershipStatus: u.membershipStatus,
      })),
    });
  });

  users.get('/membership-requests/count', requireAdmin, (req, res) => res.json({ count: pendingList().length }));

  users.put('/membership-requests/:userId', requireAdmin, (req, res) => {
    const { decision } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Quyết định duyệt không hợp lệ' });
    const u = pendingList().find((x) => x.id === req.params.userId);
    if (!u) return res.status(409).json({ error: 'Yêu cầu không còn chờ duyệt hoặc không tồn tại. Vui lòng tải lại danh sách.' });
    u.membershipStatus = decision;
    u.membershipReviewedAt = new Date().toISOString();
    u.membershipReviewedBy = req.user.id;
    res.json({ message: decision === 'APPROVED' ? 'Đã duyệt thành viên vào CLB' : 'Đã từ chối yêu cầu tham gia CLB' });
  });

  users.put('/profile', (req, res) => {
    const { displayName, phone, bankInfo, isGoalkeeper } = req.body || {};
    if (!displayName || !String(displayName).trim()) return res.status(400).json({ error: 'Tên hiển thị không được để trống' });
    if (String(displayName).trim().length > 50) return res.status(400).json({ error: 'Tên hiển thị tối đa 50 ký tự' });
    const u = req.user;
    u.displayName = String(displayName).trim();
    if (phone !== undefined) {
      const clean = phone ? String(phone).trim() : '';
      if (clean) {
        const compact = clean.replace(/[\s.-]/g, '');
        if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(compact)) {
          return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (VD: 0901234567)' });
        }
        u.phone = compact;
      } else u.phone = null;
    }
    if (bankInfo !== undefined) u.bankInfo = (bankInfo && String(bankInfo).trim()) || null;
    if (isGoalkeeper !== undefined) u.isGoalkeeper = Boolean(isGoalkeeper);
    res.json({ message: 'Cập nhật thông tin thành công', user: publicUser(u) });
  });

  users.put('/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại' });
    if (typeof newPassword !== 'string' || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' });
    if (currentPassword !== req.user.password) return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    req.user.password = newPassword;
    res.json({ message: 'Đổi mật khẩu thành công' });
  });

  users.put('/avatar', (req, res) => {
    const err = checkImage(req.body?.avatar, 'Ảnh đại diện không được để trống', 'Ảnh đại diện tối đa 2MB');
    if (err) return res.status(400).json({ error: err });
    req.user.avatar = req.body.avatar;
    res.json({ message: 'Cập nhật ảnh đại diện thành công', avatar: req.user.avatar });
  });
  users.delete('/avatar', (req, res) => { req.user.avatar = null; res.json({ message: 'Xóa ảnh đại diện thành công' }); });

  users.put('/qr-code', (req, res) => {
    const err = checkImage(req.body?.qrCodeImage, 'Ảnh QR code không được để trống', 'Ảnh QR code tối đa 2MB');
    if (err) return res.status(400).json({ error: err });
    req.user.qrCodeImage = req.body.qrCodeImage;
    res.json({ message: 'Upload QR code thành công' });
  });
  users.delete('/qr-code', (req, res) => { req.user.qrCodeImage = null; res.json({ message: 'Xóa QR code thành công' }); });

  users.get('/:id/qr-code', (req, res) => {
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ userId: u.id, displayName: u.displayName, qrCodeImage: u.qrCodeImage });
  });

  users.put('/:userId/tier', requireAdmin, (req, res) => {
    const u = findUser(req.params.userId);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const t = req.body?.tier;
    u.tier = (typeof t === 'string' && t.trim()) || null;
    res.json({ message: 'Cập nhật tier thành công', user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role, tier: u.tier } });
  });

  users.put('/:userId/goalkeeper', requireAdmin, (req, res) => {
    const u = findUser(req.params.userId);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    u.isGoalkeeper = Boolean(req.body?.isGoalkeeper);
    res.json({ message: 'Cập nhật vai trò thủ môn thành công', user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role, tier: u.tier, isGoalkeeper: u.isGoalkeeper } });
  });

  users.delete('/:userId', requireAdmin, (req, res) => {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
    const u = findUser(userId);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    if (u.role === 'ADMIN') return res.status(403).json({ error: 'Không thể xóa tài khoản Admin' });
    db.payments = db.payments.filter((p) => p.userId !== userId);
    db.sessions.forEach((s) => { if (s.payerId === userId) s.payerId = null; });
    db.users = db.users.filter((x) => x.id !== userId);
    res.json({ message: `Đã xóa thành viên ${u.displayName}` });
  });

  // =====================================================
  //                  PAYMENT COLLECTION
  // =====================================================
  const payments = express.Router();

  const checkAndCompleteSession = (sessionId) => {
    const all = db.payments.filter((p) => p.sessionId === sessionId);
    if (all.every((p) => p.status === 'CONFIRMED')) {
      const s = findSession(sessionId);
      if (s && s.status === 'BOOKED') { s.status = 'COMPLETED'; return true; }
    }
    return false;
  };
  const confirmNow = (p) => {
    p.status = 'CONFIRMED';
    p.paidAt = p.paidAt || new Date().toISOString();
    p.confirmedAt = new Date().toISOString();
  };
  const withUser = (p) => {
    const u = findUser(p.userId);
    return { ...p, user: u ? { id: u.id, displayName: u.displayName, avatar: u.avatar } : null };
  };
  const STATUS_ORDER = { PENDING: 0, PAID: 1, CONFIRMED: 2 };

  // Public webhook (không JWT) – mô phỏng PayOS
  payments.post('/payos-webhook', (req, res) => {
    const body = req.body || {};
    if (!body.signature || body.signature === 'invalid' || !body.data) {
      return res.status(400).json({ error: 'Chữ ký webhook không hợp lệ' });
    }
    if (body.code === '00') {
      const orderCode = Number(body.data.orderCode);
      const p = db.payments.find((x) => (orderCode && x.orderCode === orderCode) || (body.data.paymentLinkId && x.paymentLinkId === String(body.data.paymentLinkId)));
      if (!p) return res.json({ success: true, message: 'Order code not found' });
      if (p.status !== 'CONFIRMED') { confirmNow(p); checkAndCompleteSession(p.sessionId); }
    }
    res.json({ success: true, message: 'Webhook processed' });
  });

  payments.use(authenticate);

  payments.get('/session/:sessionId', (req, res) => {
    const s = findSession(req.params.sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    const payer = s.payerId ? findUser(s.payerId) : null;
    const list = db.payments.filter((p) => p.sessionId === s.id).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).map(withUser);
    res.json({
      session: {
        id: s.id, totalCost: s.totalCost, status: s.status,
        payer: payer ? { id: payer.id, displayName: payer.displayName, bankInfo: payer.bankInfo, phone: payer.phone, avatar: payer.avatar } : null,
      },
      payments: list,
      summary: {
        totalCost: s.totalCost,
        pending: list.filter((p) => p.status === 'PENDING').length,
        paid: list.filter((p) => p.status === 'PAID').length,
        confirmed: list.filter((p) => p.status === 'CONFIRMED').length,
        total: list.length,
      },
    });
  });

  payments.put('/:id/mark-paid', (req, res) => {
    const p = findPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payment not found' });
    if (p.userId !== req.user.id) return res.status(403).json({ error: 'You can only mark your own payment' });
    p.status = 'PAID';
    p.paidAt = new Date().toISOString();
    res.json({ message: 'Payment marked as paid', payment: p });
  });

  payments.put('/:id/confirm', (req, res) => {
    const p = findPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payment not found' });
    const s = findSession(p.sessionId);
    if (s.payerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only the payer or admin can confirm payments' });
    p.status = 'CONFIRMED';
    p.confirmedAt = new Date().toISOString();
    const sessionCompleted = checkAndCompleteSession(p.sessionId);
    res.json({
      message: sessionCompleted ? 'Payment confirmed! All payments completed - session marked as COMPLETED' : 'Payment confirmed',
      payment: p, sessionCompleted,
    });
  });

  payments.post('/payos-confirm-webhook', (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin mới có quyền cấu hình Webhook' });
    const base = `${req.protocol}://${req.get('host')}`;
    const webhookUrl = req.body?.webhookUrl || `${base}/api/payments/payos-webhook`;
    res.json({ message: 'Đăng ký Webhook với PayOS thành công', result: { mock: true }, webhookUrl });
  });

  payments.post('/:id/payos-link', (req, res) => {
    const p = findPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'Không tìm thấy khoản thanh toán' });
    if (p.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Bạn không có quyền thanh toán cho khoản này' });
    if (p.status === 'CONFIRMED') return res.status(400).json({ error: 'Khoản thanh toán này đã được xác nhận hoàn tất' });

    const owner = findUser(p.userId);
    if (!(p.orderCode && p.accountNumber)) {
      const s = findSession(p.sessionId);
      const payer = (s.payerId && findUser(s.payerId)) || db.users[0];
      const orderCode = Number(String(Date.now()) + String(Math.floor(Math.random() * 10)));
      p.orderCode = orderCode;
      p.paymentLinkId = 'link_' + crypto.randomBytes(5).toString('hex');
      p.checkoutUrl = `https://pay.payos.vn/web/${crypto.randomBytes(16).toString('hex')}`;
      p.accountNumber = '102873491823';
      p.accountName = payer.displayName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toUpperCase();
      p.bin = '970422';
      p.description = `CSE ${owner.displayName}`;
      p.qrCode = `00020101021238540010A0000007270124000697042201081028734918230208QRIBFTTA5303704540${p.amount}5802VN62${p.description.length}${p.description}6304MOCK`;
    }
    res.json({
      payment: p, orderCode: p.orderCode, checkoutUrl: p.checkoutUrl, qrCode: p.qrCode,
      amount: Number(p.amount), description: p.description, accountName: p.accountName,
      accountNumber: p.accountNumber, bin: p.bin,
    });
  });

  payments.get('/:id/payos-status', (req, res) => {
    const p = findPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'Không tìm thấy khoản thanh toán' });
    const payment = withUser(p);
    if (p.status === 'CONFIRMED') return res.json({ status: 'CONFIRMED', payment, isPaid: true });
    if (p.orderCode) return res.json({ status: p.status, payosStatus: 'PENDING', payment, isPaid: false });
    res.json({ status: p.status, payment, isPaid: false });
  });

  app.use('/api/users', users);
  app.use('/api/payments', payments);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status === 400 ? 'Request body không hợp lệ' : 'Internal server error' });
  });
  return app;
}

module.exports = { createApp };
