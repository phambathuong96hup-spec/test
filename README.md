# 🏥 Hệ thống Quản lý Trang thiết bị Y tế

**WebApp Dược Khoa — Trung tâm Y tế khu vực Thanh Ba**

Ứng dụng web quản lý toàn bộ vòng đời trang thiết bị y tế: từ nhập kho, theo dõi trạng thái, báo hỏng/sửa chữa, luân chuyển giữa các khoa, đến giám sát nhiệt độ/độ ẩm kho (GSP).

## ✨ Tính năng chính

| Module | Mô tả |
|---|---|
| **Dashboard** | Tổng quan KPI, biểu đồ phân bổ thiết bị, cảnh báo đăng kiểm |
| **Quản lý Thiết bị** | Danh sách, tìm kiếm, filter, thêm/sửa, in QR hàng loạt |
| **Báo hỏng / Sửa chữa** | Tạo yêu cầu, quét QR, duyệt/từ chối (Admin), theo dõi trạng thái |
| **Luân chuyển** | Cho mượn, mượn, trả thiết bị giữa các khoa/phòng |
| **Thống kê & Báo cáo** | Xuất PDF/CSV, báo cáo kiểm định, sửa chữa xong |
| **Nhật ký GSP** | Ghi nhận nhiệt độ/độ ẩm kho, biểu đồ dao động, cảnh báo vi phạm |

## 🛠 Tech Stack

- **Frontend:** React 19 + TypeScript 5.9 + Vite 8
- **Routing:** react-router-dom v7
- **UI:** Lucide Icons, Chart.js, QRCode.react
- **Export:** jsPDF + jspdf-autotable
- **Backend:** Google Apps Script (Google Sheets)
- **Auth:** Session-based (PIN login)

## 🚀 Chạy Local

```bash
# Cài dependencies
npm install

# Dev server
npm run dev

# Build production
npm run build

# Preview build
npm run preview
```

## 📁 Cấu trúc thư mục

```
src/
├── components/
│   ├── layout/          # MasterLayout, Sidebar, TopNav
│   ├── ui/              # Button, Badge, Card, Input, Table, Tabs
│   └── ErrorBoundary.tsx
├── pages/
│   ├── Dashboard.tsx     # Tổng quan hệ thống
│   ├── DeviceList.tsx    # Danh sách thiết bị
│   ├── DeviceProfile.tsx # Chi tiết thiết bị
│   ├── RepairRequest.tsx # Báo hỏng / Sửa chữa
│   ├── Transfers.tsx     # Luân chuyển thiết bị
│   ├── Requests.tsx      # Hub tạo yêu cầu
│   ├── Reports.tsx       # Thống kê & Báo cáo
│   ├── GspLog.tsx        # Nhật ký GSP
│   └── Login.tsx         # Đăng nhập
├── services/
│   └── api.ts            # API layer (Google Sheets)
├── utils/
│   └── exportCsv.ts      # CSV export utility
├── authContext.ts         # React Context for auth
├── authSession.ts         # Session management
├── AuthProvider.tsx       # Auth state provider
├── App.tsx               # Router + Guards
└── main.tsx              # Entry point
```

## 🔐 Phân quyền

| Role | Xem TB | Tạo yêu cầu | Duyệt/Từ chối | Thêm/Sửa TB | Quản trị |
|---|:---:|:---:|:---:|:---:|:---:|
| **Chưa đăng nhập** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

## 📋 Deploy

Xem [README.deploy.md](./README.deploy.md) để biết quy trình deploy vào website chính.

## 📄 License

Internal use — Trung tâm Y tế khu vực Thanh Ba.
