/**
 * Nạp spec gốc của repo (openapi.base.json) rồi chỉnh để chạy với mock server:
 *  - servers: trỏ về chính site này
 *  - description: thêm bảng token + ID mẫu
 *  - parameters: điền sẵn example là ID có thật trong DB ảo
 */
const base = require('../openapi.base.json');
const { ID } = require('./db');

function buildSpec() {
  const spec = JSON.parse(JSON.stringify(base));

  spec.servers = [{ url: '/', description: 'Mock server (database ảo – chính site này)' }];

  spec.info.description += `

---
### 🧪 Môi trường DEMO – Database ảo
Trang này chạy trên **database ảo (in-memory)**, không cần PostgreSQL / PayOS. Dữ liệu mẫu nạp sẵn, thay đổi chỉ tồn tại tới khi server khởi động lại (hoặc gọi \`POST /mock/reset\`).

**Token đăng nhập giả** (đã tự điền sẵn \`admin-token\` ở nút **Authorize** – đổi sang token khác nếu muốn test phân quyền):

| Token | Vai trò | Ghi chú |
|---|---|---|
| \`admin-token\` | ADMIN | Nguyễn Hoàng Phúc – thủ quỹ của buổi đấu |
| \`member-token\` | MEMBER | Nguyễn Văn An – có khoản \`PENDING\` |
| \`member2-token\` | MEMBER | Lê Thị Bình – có khoản \`PAID\` |
| \`pending-token\` | MEMBER (chưa duyệt) | Gọi API sẽ trả **403** |

**ID mẫu** (đã điền sẵn vào các ô tham số):

| Loại | ID |
|---|---|
| Đơn chờ duyệt | \`${ID.pending1}\`, \`${ID.pending2}\`, \`${ID.pending3}\` |
| Thành viên | An \`${ID.an}\` · Bình \`${ID.binh}\` · Cường \`${ID.cuong}\` |
| Buổi đấu (BOOKED) | \`${ID.sessionBooked}\` |
| Payment của An (PENDING) | \`${ID.payAn}\` |
| Payment của Bình (PAID) | \`${ID.payBinh}\` |

Mật khẩu của mọi tài khoản mẫu: \`OldPassword@123\`.

**Giả lập PayOS:** \`POST /api/payments/{id}/payos-link\` trả về orderCode + QR giả; sau đó gọi \`POST /api/payments/payos-webhook\` với \`code: "00"\` và \`orderCode\` vừa nhận để mô phỏng "khách đã chuyển khoản" (signature bất kỳ, trừ chuỗi rỗng hoặc \`invalid\`).
`;

  // Ví dụ tham số theo từng endpoint
  const examples = {
    '/api/users/membership-requests/{userId}': { userId: ID.pending1 },
    '/api/users/{userId}/tier': { userId: ID.binh },
    '/api/users/{userId}/goalkeeper': { userId: ID.binh },
    '/api/users/{userId}': { userId: ID.em },
    '/api/users/{id}/qr-code': { id: ID.an },
    '/api/payments/session/{sessionId}': { sessionId: ID.sessionBooked },
    '/api/payments/{id}/mark-paid': { id: ID.payAn },
    '/api/payments/{id}/confirm': { id: ID.payBinh },
    '/api/payments/{id}/payos-link': { id: ID.payAn },
    '/api/payments/{id}/payos-status': { id: ID.payAn },
  };
  for (const [path, byName] of Object.entries(examples)) {
    for (const op of Object.values(spec.paths[path] || {})) {
      for (const p of op.parameters || []) {
        if (byName[p.name]) p.example = byName[p.name];
      }
    }
  }

  // Ví dụ body cho mark-paid/confirm/delete hợp với dữ liệu mẫu
  const tier = spec.components.schemas.UpdateTierBody?.properties?.tier;
  if (tier) tier.example = 'A';

  return spec;
}

module.exports = { buildSpec };
