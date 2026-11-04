# Diễn đàn M&A Miền Trung 2026

Landing page sự kiện VMAA, chạy bằng HTML, CSS và JavaScript thuần.

Website GitHub Pages: https://kirei1805.github.io/VMMA/

## Chỉnh sửa

- `index.html`: cấu trúc, nội dung các section và khối pha lê mở đầu.
- `content.js`: dữ liệu sự kiện, hồ sơ dự kiến, chương trình và thông tin tham dự.
- `app.js`: animation, tương tác, bộ lọc chương trình, xem hồ sơ và tải lịch ICS.
- `styles.css`, `sections.css`: kiểu chữ, bảng màu và bố cục chung.
- `hero-v2.css`: chữ key visual và M&A lấy từ artwork gốc.
- `takeaways.css`: Section 7 với nội dung gom trái, ảnh đổi theo mục ở bên phải.
- `portfolio-update.css`: bố cục nội dung bổ sung theo portfolio Canva tháng 11.2026.
- `assets/`: hình ảnh và font tự lưu.
- `licenses/`: giấy phép font.

Chạy thử tại thư mục repo:

```sh
python3 -m http.server 4173
```

Mở http://127.0.0.1:4173/ để xem.

## Xuất bản

Mỗi lần push vào `main`, workflow `.github/workflows/pages.yml` triển khai toàn bộ trang tĩnh lên GitHub Pages. Theo dõi tiến trình tại tab Actions. Repository Settings → Pages dùng nguồn **GitHub Actions**.

Đường dẫn ảnh, font, CSS và JavaScript đều tương đối để hoạt động dưới `/VMMA/`.

## Trạng thái nội dung

Nội dung cập nhật theo [portfolio chuẩn trên Canva](https://www.canva.com/design/DAHZYP2Oy8w/6U8wKzVL9h2sREGejGKhbQ/edit), đối chiếu ngày 04.11.2026: 5 diễn giả dự kiến, 11 mục lịch trình (gồm đón khách và tiệc tối), 6 nhóm khách tham dự, thông tin VMAA, 4 hạng tài trợ và quyền lợi, truyền thông, đầu mối liên hệ. Mục về Diễn đàn M&A Mùa Thu 13.11 trong portfolio là một sự kiện khác, không dùng làm thông tin cho sự kiện Miền Trung 13.12.

Diễn giả và chương trình vẫn là bản dự kiến. Giá vé, hạn đăng ký, địa điểm cụ thể và danh sách đối tác/truyền thông đang chờ công bố; không coi các logo giữ chỗ trong portfolio là đối tác xác nhận. Đầu mối: Mr. Antony Vũ, Trưởng ban tổ chức — 0913.989.365, vmaacentral@gmail.com. Nút đăng ký/đối tác cuộn tới nội dung trên trang; các nút gọi điện/email mở kênh liên hệ tương ứng. Hiện trang không có backend hoặc biểu mẫu thu thập thông tin cá nhân.

Artwork nhận diện được sử dụng từ bộ tài sản VMAA do chủ dự án cung cấp. Manrope, Plus Jakarta Sans và Outfit được lưu tại chỗ; giấy phép font nằm trong `licenses/`.
