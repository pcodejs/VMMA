(function (root) {
  const config = {
    price: 500000,
    receiptFieldId: 'fld1O49NDC',
    maxReceiptBytes: 2 * 1024 * 1024,
    bank: {
      bin: '970416',
      name: 'ACB',
      account: '621866',
      accountName: 'Công ty Cổ phần Đầu tư IPC M&A Việt Nam'
    },
    companySizes: ['Dưới 50 nhân sự', '50 – 200 nhân sự', '201 – 500 nhân sự', '501 – 1.000 nhân sự', 'Trên 1.000 nhân sự'],
    stages: ['Khởi nghiệp / mới thành lập', 'Đang tăng trưởng', 'Ổn định, trưởng thành', 'Đang tái cấu trúc', 'Chuẩn bị gọi vốn, M&A hoặc IPO', 'Quỹ đầu tư / đơn vị tư vấn'],
    industries: ['Bất động sản', 'Công nghiệp, Logistics & Chuỗi cung ứng', 'Du lịch, Nhà hàng – Khách sạn', 'Công nghệ', 'Y tế – Sức khỏe', 'Giáo dục', 'Tài chính – Ngân hàng – Đầu tư', 'Tư vấn – Pháp lý – Kiểm toán', 'Sản xuất', 'Bán lẻ & Hàng tiêu dùng', 'Khác'],
    sessions: [
      'Tham dự toàn bộ chương trình',
      'Dòng vốn & M&A Việt Nam 2026: Những cơ hội đầu tư tiếp theo',
      'Thảo luận 1: Doanh nghiệp Miền Trung – Làm gì để bứt phá thành doanh nghiệp dẫn đầu?',
      'Thảo luận 2: Chiến lược vốn cho tăng trưởng – Công nghệ và các ngành dẫn dắt làn sóng đầu tư mới',
      'M&A Reality Check: Điều gì làm nên một thương vụ thành công?',
      'Deal Connect – Kết nối doanh nghiệp, nhà đầu tư và đối tác chiến lược'
    ],
    quantities: ['1 vé', '2 vé', '3 vé', '4 vé', '5 vé', 'Trên 5 vé (Liên hệ Ban tổ chức để nhận giá ưu đãi)'],
    paymentLabels: {
      paid: 'Tôi đã chuyển khoản phí tham dự',
      guest: 'Tôi là khách mời / diễn giả / đối tác (không cần thanh toán)',
      bulk: 'Tôi đăng ký trên 5 vé và chờ Ban tổ chức liên hệ'
    },
    fieldIds: {
      name: 'fld2hJoYwG', phone: 'fldYGMiTgF', email: 'fldzHB6qIr',
      company: 'fldBf5wvXt', title: 'fld5XBBP7C', companySize: 'fldgH4L5HI',
      stage: 'fldZhnxK3v', industry: 'fldY9JP3Q2', industryOther: 'fldpIr8Dkq', sessions: 'fldmyrqafx',
      inviteCode: 'fld7KEG8lq', quantity: 'fld1lcl8fp', payment: 'fldCEUM1kz'
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.VMAA_REGISTRATION_CONFIG = config;
})(typeof window === 'object' ? window : globalThis);
