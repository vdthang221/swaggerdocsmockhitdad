/**
 * "Database ảo" – lưu trong bộ nhớ (in-memory), nạp dữ liệu mẫu khi khởi động.
 * Mô phỏng 3 bảng chính của Prisma schema: users, sessions, payments.
 * Khởi động lại server (hoặc gọi POST /mock/reset) sẽ trả dữ liệu về ban đầu.
 */

// ID cố định để copy/paste vào Swagger "Try it out"
const ID = {
  admin:    '11111111-1111-4111-8111-000000000001',
  an:       '11111111-1111-4111-8111-000000000002',
  binh:     '11111111-1111-4111-8111-000000000003',
  cuong:    '11111111-1111-4111-8111-000000000004',
  dung:     '11111111-1111-4111-8111-000000000005',
  em:       '11111111-1111-4111-8111-000000000006',
  pending1: '11111111-1111-4111-8111-000000000007',
  pending2: '11111111-1111-4111-8111-000000000008',
  pending3: '11111111-1111-4111-8111-000000000009',
  sessionBooked:    '22222222-2222-4222-8222-000000000001',
  sessionCompleted: '22222222-2222-4222-8222-000000000002',
  payAn:    '33333333-3333-4333-8333-000000000001', // PENDING  (của An)
  payBinh:  '33333333-3333-4333-8333-000000000002', // PAID     (của Bình)
  payCuong: '33333333-3333-4333-8333-000000000003', // PENDING  (của Cường)
  payDung:  '33333333-3333-4333-8333-000000000004', // CONFIRMED
  payEm:    '33333333-3333-4333-8333-000000000005', // CONFIRMED
};

// Token giả: Authorization: Bearer <token>
const TOKENS = {
  'admin-token':   ID.admin,   // ADMIN (thủ quỹ / payer)
  'member-token':  ID.an,      // MEMBER – Nguyễn Văn An
  'member2-token': ID.binh,    // MEMBER – Lê Thị Bình
  'pending-token': ID.pending1 // Chưa được duyệt -> 403
};

const PASSWORD = 'OldPassword@123';
const iso = (d) => new Date(d).toISOString();

function seed() {
  const users = [
    { id: ID.admin, username: 'admin', email: 'admin@cse-punchdad.dev', displayName: 'Nguyễn Hoàng Phúc', role: 'ADMIN', membershipStatus: 'APPROVED', tier: 'A', isGoalkeeper: false, phone: '0901000001', bankInfo: 'MBBank - 102873491823 - NGUYEN HOANG PHUC', avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-01-05T08:00:00Z') },
    { id: ID.an, username: 'nguyenvanan', email: 'an.nguyen@example.com', displayName: 'Nguyễn Văn An', role: 'MEMBER', membershipStatus: 'APPROVED', tier: 'B', isGoalkeeper: false, phone: '0901234567', bankInfo: 'Vietcombank - 0123456789 - NGUYEN VAN AN', avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-01-15T08:30:00Z') },
    { id: ID.binh, username: 'lethibinh', email: 'binh.le@example.com', displayName: 'Lê Thị Bình', role: 'MEMBER', membershipStatus: 'APPROVED', tier: 'C', isGoalkeeper: false, phone: '0912345670', bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-02-01T09:00:00Z') },
    { id: ID.cuong, username: 'tranquoccuong', email: 'cuong.tran@example.com', displayName: 'Trần Quốc Cường', role: 'MEMBER', membershipStatus: 'APPROVED', tier: 'A', isGoalkeeper: true, phone: '0933456789', bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-02-10T09:00:00Z') },
    { id: ID.dung, username: 'phamthidung', email: 'dung.pham@example.com', displayName: 'Phạm Thị Dung', role: 'MEMBER', membershipStatus: 'APPROVED', tier: 'D', isGoalkeeper: false, phone: '0977123456', bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-03-01T09:00:00Z') },
    { id: ID.em, username: 'hoangvanem', email: 'em.hoang@example.com', displayName: 'Hoàng Văn Em', role: 'MEMBER', membershipStatus: 'APPROVED', tier: null, isGoalkeeper: false, phone: null, bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-03-20T09:00:00Z') },
    { id: ID.pending1, username: 'tranvanbinh', email: 'binh.tran@example.com', displayName: 'Trần Văn Bình', role: 'MEMBER', membershipStatus: 'PENDING', tier: null, isGoalkeeper: false, phone: '0912345678', bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-11-01T10:00:00Z') },
    { id: ID.pending2, username: 'vuthihoa', email: 'hoa.vu@example.com', displayName: 'Vũ Thị Hoa', role: 'MEMBER', membershipStatus: 'PENDING', tier: null, isGoalkeeper: false, phone: '0988111222', bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-11-02T07:30:00Z') },
    { id: ID.pending3, username: 'dangminhkhoa', email: 'khoa.dang@example.com', displayName: 'Đặng Minh Khoa', role: 'MEMBER', membershipStatus: 'PENDING', tier: null, isGoalkeeper: false, phone: null, bankInfo: null, avatar: null, qrCodeImage: null, password: PASSWORD, createdAt: iso('2026-11-02T15:45:00Z') },
  ];

  const sessions = [
    { id: ID.sessionBooked, title: 'Đá sân 7 tối thứ Năm', status: 'BOOKED', totalCost: 500000, payerId: ID.admin, playDate: iso('2026-11-05T00:00:00Z') },
    { id: ID.sessionCompleted, title: 'Đá sân 7 cuối tuần trước', status: 'COMPLETED', totalCost: 400000, payerId: ID.admin, playDate: iso('2026-10-25T00:00:00Z') },
  ];

  const mk = (id, sessionId, userId, amount, status, extra = {}) => ({
    id, sessionId, userId, amount, status,
    orderCode: null, checkoutUrl: null, paymentLinkId: null, accountNumber: null,
    accountName: null, bin: null, qrCode: null, description: null,
    paidAt: null, confirmedAt: null, ...extra,
  });

  const payments = [
    mk(ID.payAn, ID.sessionBooked, ID.an, 100000, 'PENDING'),
    mk(ID.payBinh, ID.sessionBooked, ID.binh, 100000, 'PAID', { paidAt: iso('2026-11-03T10:15:00Z') }),
    mk(ID.payCuong, ID.sessionBooked, ID.cuong, 100000, 'PENDING'),
    mk(ID.payDung, ID.sessionBooked, ID.dung, 100000, 'CONFIRMED', { paidAt: iso('2026-11-03T09:00:00Z'), confirmedAt: iso('2026-11-03T09:05:00Z') }),
    mk(ID.payEm, ID.sessionBooked, ID.em, 100000, 'CONFIRMED', { paidAt: iso('2026-11-03T09:10:00Z'), confirmedAt: iso('2026-11-03T09:20:00Z') }),
  ];

  // Số buổi COMPLETED đã check-in (để trả về _count.votes)
  const attendance = { [ID.admin]: 12, [ID.an]: 12, [ID.binh]: 8, [ID.cuong]: 10, [ID.dung]: 3, [ID.em]: 0 };

  return { users, sessions, payments, attendance };
}

const db = seed();
function reset() {
  const fresh = seed();
  db.users = fresh.users;
  db.sessions = fresh.sessions;
  db.payments = fresh.payments;
  db.attendance = fresh.attendance;
}

module.exports = { db, reset, ID, TOKENS, PASSWORD };
