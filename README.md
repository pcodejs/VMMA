# Diễn đàn M&A Miền Trung 2026

Landing page VMAA dùng HTML, CSS và JavaScript thuần, kèm Vercel Functions để tiếp nhận đăng ký vào Lark Base và tạo QR chuyển khoản.

## Chạy cục bộ

Yêu cầu Node.js 22 trở lên.

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:4173/ để xem trang. Các API đăng ký cần biến môi trường Lark hợp lệ trong `.env.local`.

```sh
npm test
npm run build
```

Lệnh build xuất trang tĩnh vào `public/`. Vercel xử lý các hàm trong `api/` riêng với tài nguyên tĩnh.

## Cấu hình Vercel

Tên dự án `vmaamientrung`. Framework đặt là Other, lệnh build `npm run build`, thư mục đầu ra `public`.

Cấu hình các biến môi trường sau trong dự án Vercel, cho môi trường cần sử dụng.

| Biến | Nội dung |
| --- | --- |
| `LARK_APP_ID` | App ID của ứng dụng Lark nội bộ đã được duyệt |
| `LARK_APP_SECRET` | App Secret của ứng dụng |
| `LARK_BASE_TOKEN` | App token của Base thực nhận đăng ký, lấy từ thông tin API của Base |
| `LARK_TABLE_ID` | ID bảng nhận đăng ký |

Ứng dụng cần quyền đọc cấu trúc trường, tạo bản ghi và quyền truy cập Base đích. Các trường được đối chiếu bằng ID trong `registration-config.js` rồi chuyển sang tên trường thật trước khi ghi dữ liệu.

Sau khi thay đổi biến môi trường, triển khai lại dự án. Khóa tích hợp được lưu trong cấu hình môi trường của Vercel.

## Đăng ký và QR

1. Khách điền thông tin và chọn phiên, hình thức tham dự, số lượng vé.
2. Máy chủ kiểm tra dữ liệu và kết nối Base trước khi trả QR.
3. Đại biểu trả phí quét QR, chuyển khoản và chọn xác nhận đã chuyển khoản.
4. Website gửi đăng ký vào Lark bằng API chính thức.
5. Ban Tổ chức xét duyệt và gửi email xác nhận chính thức.

Giá hiện tại 500.000đ/vé theo form Lark được đối chiếu ngày 07.11.2026. Khách mời, diễn giả và đối tác được miễn phí. Đăng ký trên 5 vé chuyển sang luồng Ban Tổ chức liên hệ.

QR được tạo trên máy chủ bằng thư viện VietQR chạy offline. Số tiền tính từ giá vé và số lượng trên máy chủ. Nội dung dùng `VMAA - Họ và Tên - SĐT`, bỏ dấu tiếng Việt khi mã hóa để tương thích chuyển khoản. Bản xem trước hiển thị cùng nội dung được mã hóa.

Trạng thái chuyển khoản là xác nhận của khách. Ban Tổ chức đối soát giao dịch và duyệt đăng ký. Yêu cầu gửi lại dùng cùng `client_token` để Lark xử lý tính lặp.

## Các tệp chính

- `index.html` chứa bố cục, nội dung tĩnh và hộp thoại đăng ký.
- `content.js` chứa dữ liệu sự kiện, diễn giả, chương trình và danh sách logo.
- `app.js` xử lý tương tác trang, hồ sơ diễn giả, bộ lọc, lịch ICS và phân nhóm logo.
- `registration-config.js` chứa cấu hình công khai, lựa chọn biểu mẫu và ID trường Lark.
- `registration.js`, `registration.css` xử lý giao diện đăng ký.
- `api/payment.js`, `api/register.js`, `lib/registration.js` xử lý QR, kiểm tra dữ liệu và kết nối Lark.
- `styles.css`, `sections.css`, `hero-v2.css`, `takeaways.css`, `portfolio-update.css` định dạng UI sự kiện.
- `sponsors.css` định dạng phần logo bổ sung.
- `assets/partners/` chứa bản logo tối ưu cho website.
- `licenses/` chứa giấy phép font lưu tại chỗ.

## Logo và nội dung

Thứ tự phân nhóm logo theo Drive là Kim cương, Vàng, Đồng, Đối tác chiến lược, Đơn vị đồng hành. Website hiển thị các nhóm có dữ liệu. Danh sách thương hiệu lấy theo đúng folder được cung cấp.

Chương trình và hồ sơ diễn giả trong bản nền vẫn được đánh dấu dự kiến. Việc cập nhật nội dung chi tiết cần đối chiếu với file Word chính thức của Ban Tổ chức.

Artwork nhận diện do chủ dự án cung cấp. Các font Manrope, Plus Jakarta Sans và Outfit được lưu tại chỗ cùng giấy phép tương ứng.
