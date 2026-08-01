# BaddyClub — Quản lý câu lạc bộ cầu lông

Ứng dụng quản lý nhóm chơi cầu lông: điểm danh buổi đánh, quản lý quỹ & tài chính thành viên, kho cầu (FIFO), gợi ý xếp cặp và thu tiền khách vãng lai qua QR thanh toán.

Xây dựng bằng **React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand**. Dữ liệu được lưu vào file `data/badminton-data.json` qua một middleware của Vite dev/preview server.

## Tính năng

- **Tổng quan**: theo dõi quỹ còn lại, chi phí, tần suất tham gia và biểu đồ quỹ & chi phí theo tháng.
- **Buổi đánh**: tạo lịch (thứ 3 & thứ 5), điểm danh, tính chi phí sân + cầu chia đều.
- **Kho cầu**: nhập lô cầu, tiêu thụ FIFO, tồn kho và giá vốn mỗi buổi.
- **Xếp cặp**: tự động chia đội và xoay vòng theo trình độ.
- **Thành viên**: phân loại Thường / Nhân viên công ty / Vãng lai, quỹ nạp trước, nợ.
- **Tài chính**: quỹ hỗ trợ, thống kê theo thành viên & buổi, thu tiền vãng lai, lịch sử giao dịch.
- **Dữ liệu demo**: khi chưa có dữ liệu, tạo nhanh bộ dữ liệu demo cho tháng đang chọn.

## Chạy local

```bash
npm install
npm run dev
```

Mặc định chạy tại `http://localhost:5173` (`strictPort`). Dữ liệu đọc/ghi qua `/api/data` (middleware của Vite preview). Nếu `data/badminton-data.json` chưa tồn tại, app sẽ dùng `data/badminton-data.example.json` làm seed.

## Biên dịch & kiểm thử

```bash
npm run build    # tsc -b && vite build
npm test         # vitest run
npm run lint     # eslint .
```

## Chạy bằng Docker

```bash
make up          # build image + start container (port 5173)
make rebuild
make logs
```

Docker gắn volume `./data:/app/data` để dữ liệu sống trên host và được giữ qua các lần khởi động lại.

## Quản lý dữ liệu

- File dữ liệu thật `data/badminton-data.json` **không được commit** (xem `.gitignore`).
- File `data/badminton-data.example.json` chứa dữ liệu demo thuần giả lập, dùng cho clone mới.
- Sao lưu / khôi phục và xóa dữ liệu có trong trang **Cài đặt → Quản lý dữ liệu**.

## Biến môi trường

Các biến sau được đọc từ `.env*` (xem Vite). Copy `.env.example` → `.env.local` và điền giá trị:

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `VITE_QR_BANK` | Không | Mã ngân hàng hiển thị trên QR thanh toán khách vãng lai (vd `ACB`). Mặc định: `ACB`. |
| `VITE_QR_ACCOUNT` | Không | Số tài khoản nhúng vào QR thanh toán (vd `2180347`). Mặc định: `2180347`. |

> ⚠️ Các biến `VITE_*` chứa thông tin tài khoản cá nhân. **Không commit `.env.local`** — nó đã nằm trong `.gitignore`. Nếu triển khai công khai, hãy cung cấp biến môi trường trong môi trường chạy thay vì dựa vào mặc định hardcode.
