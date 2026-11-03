# Hướng dẫn deploy link Swagger

Đây là một server Node (Express) nên cần nơi chạy Node. **Khuyên dùng Render (miễn phí)**, không cần thẻ.
Kết quả: `https://<tên-service>.onrender.com/api-docs`

## Cách 1 – Render (khuyên dùng)

### Bước 1: Đưa code lên GitHub
Chọn một trong hai:

**A. Repo riêng (đơn giản nhất)**
```bash
cd punchdad-swagger-mock
git init && git add . && git commit -m "Swagger mock docs"
git branch -M main
git remote add origin https://github.com/<user>/punchdad-swagger-docs.git
git push -u origin main
```

**B. Nằm trong repo CSE_PunchDad**
Chép cả thư mục này vào repo với tên `swagger-mock/`, commit và push.
Khi tạo service trên Render, ở **Root Directory** nhập `swagger-mock`.

### Bước 2: Tạo Web Service trên Render
1. Vào https://render.com → đăng nhập bằng GitHub.
2. **New +** → **Web Service** → chọn repo vừa push (cấp quyền cho Render nếu được hỏi).
3. Điền:
   - **Name**: `punchdad-swagger-docs` (tên này quyết định URL)
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: để trống (cách A) hoặc `swagger-mock` (cách B)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
   - Mục *Advanced* → **Health Check Path**: `/health`
4. Bấm **Create Web Service**, chờ 2–3 phút tới khi log báo `PunchDad Swagger mock chạy tại ...`.
5. Mở `https://punchdad-swagger-docs.onrender.com/api-docs`.

(Hoặc dùng file `render.yaml` có sẵn: **New +** → **Blueprint** → chọn repo.)

### Lưu ý khi dùng gói Free
- Sau ~15 phút không có truy cập, service ngủ đông; lần mở đầu tiên chậm khoảng 30–60 giây.
- Mỗi lần ngủ/khởi động lại, database ảo trở về dữ liệu mẫu (đúng ý demo).
- Trước buổi demo/báo cáo, hãy mở link trước vài phút để service "thức dậy".

## Cách 2 – Railway
1. https://railway.com → **New Project** → **Deploy from GitHub repo** → chọn repo.
2. Vào service → **Settings** → **Networking** → **Generate Domain**.
3. Railway tự nhận `npm start` và biến `PORT`. Link: `https://<domain>/api-docs`.

## Cách 3 – Chạy tạm bằng tunnel (không cần deploy)
```bash
npm start
npx localtunnel --port 5001      # hoặc: cloudflared tunnel --url http://localhost:5001
```
Link tạm thời, tắt máy là mất. Phù hợp khi cần demo gấp.

## Vì sao không dùng Vercel/Netlify/GitHub Pages?
Các nơi này chỉ host file tĩnh hoặc serverless, không giữ được database ảo trong RAM, nên nút
**Try it out** sẽ không chạy đúng. Trang tĩnh trong repo (`docs/swagger-web/`) chỉ để đọc tài liệu.

## Kiểm tra sau khi deploy
1. `https://<link>/health` → `{"status":"ok","mode":"mock-in-memory-db"}`
2. `https://<link>/api-docs` → thấy 2 nhóm **User** và **Payment**, nút Authorize đã có `admin-token`.
3. Mở `GET /api/users/members` → **Try it out** → **Execute** → trả 200 và danh sách thành viên.
