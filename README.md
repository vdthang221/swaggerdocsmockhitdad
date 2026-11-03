# PunchDad Swagger Docs (User + Payment) – Database ảo

Web Swagger gồm 2 collection **User** (15 endpoint) và **Payment** (7 endpoint), lấy từ repo
`nbThien0101/CSE_PunchDad` (`server/src/docs/swagger.json`), chạy trên **database ảo in-memory**
nên không cần PostgreSQL, PayOS hay biến môi trường nào.

## Chạy local
```bash
npm install
npm start          # http://localhost:5001/api-docs
npm test           # 15 test cho toàn bộ endpoint
```

## Dùng thử trên Swagger
- Nút **Authorize** đã điền sẵn `admin-token`. Đổi sang token khác để test phân quyền:

| Token | Vai trò |
|---|---|
| `admin-token` | ADMIN (thủ quỹ) |
| `member-token` | MEMBER – An (có khoản PENDING) |
| `member2-token` | MEMBER – Bình (có khoản PAID) |
| `pending-token` | Chưa duyệt → 403 |

- Các ô tham số (`userId`, `id`, `sessionId`) đã điền sẵn ID có thật.
- Giả lập thanh toán PayOS: `POST /api/payments/{id}/payos-link` → lấy `orderCode` →
  `POST /api/payments/payos-webhook` với `code: "00"` + `orderCode` đó (signature bất kỳ, trừ rỗng/`invalid`)
  → payment chuyển `CONFIRMED`.
- Reset dữ liệu: `POST /mock/reset`. Xem token/ID: `GET /mock/tokens`. Health: `GET /health`.

## Cấu trúc
```
src/db.js          database ảo + dữ liệu mẫu (users, sessions, payments)
src/app.js         22 endpoint + Swagger UI
src/openapi.js     nạp openapi.base.json, điền ví dụ/ID mẫu
openapi.base.json  spec gốc copy từ repo
tests/             test tự động
```
Cập nhật spec: chép lại `server/src/docs/swagger.json` của repo đè lên `openapi.base.json`.

## Lưu ý
Dữ liệu nằm trong RAM: khởi động lại/ngủ đông (Render free) là trở về dữ liệu mẫu. Đây là môi trường demo,
không có JWT thật, không dùng cho production.

Hướng dẫn deploy: xem `DEPLOY.md`.
