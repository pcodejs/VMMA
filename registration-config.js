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
    connections: [
      'Doanh nghiệp đang tìm nhà đầu tư hoặc đối tác chiến lược',
      'Doanh nghiệp có nhu cầu mua lại, sáp nhập để mở rộng',
      'Doanh nghiệp, chủ dự án muốn chuyển nhượng',
      'Nhà đầu tư chiến lược trong nước hoặc quốc tế',
      'Quỹ đầu tư',
      'Ngân hàng, tổ chức tài chính',
      'Đơn vị tư vấn M&A, luật, kiểm toán, định giá',
      'Khác'
    ],
    quantities: ['1 vé', '2 vé', '3 vé', '4 vé', '5 vé', 'Trên 5 vé (Liên hệ Ban tổ chức để nhận giá ưu đãi)'],
    privacyConsents: [
      'Tôi đồng ý để BTC sử dụng thông tin của tôi cho mục đích đăng ký và liên hệ về sự kiện.',
      'Tôi đồng ý để BTC sử dụng thông tin của tôi, bao gồm việc kết nối với các đối tác của chương trình.'
    ],
    paymentLabels: {
      paid: 'Tôi đã chuyển khoản phí tham dự',
      guest: 'Tôi là khách mời / diễn giả / đối tác (không cần thanh toán)',
      bulk: 'Tôi đăng ký trên 5 vé và chờ Ban tổ chức liên hệ'
    },
    fieldIds: {
      name: 'fld2hJoYwG', phone: 'fldYGMiTgF', email: 'fldzHB6qIr',
      company: 'fldBf5wvXt', title: 'fld5XBBP7C', companySize: 'fldgH4L5HI',
      stage: 'fldZhnxK3v', industry: 'fldY9JP3Q2', industryOther: 'fldpIr8Dkq',
      connections: 'fldmyrqafx', connectionsOther: 'fldQjssn7U',
      inviteCode: 'fld7KEG8lq', quantity: 'fld1lcl8fp', payment: 'fldCEUM1kz', privacyConsent: 'fld3LZnubC',
      invoiceInfo: 'flde0FLtuK'
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.VMAA_REGISTRATION_CONFIG = config;
})(typeof window === 'object' ? window : globalThis);
