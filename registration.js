(() => {
  'use strict';
  const config = window.VMAA_REGISTRATION_CONFIG;
  const dialog = document.querySelector('#registration-dialog');
  const form = document.querySelector('#registration-form');
  const status = document.querySelector('#registration-status');
  const information = document.querySelector('#registration-information');
  const payment = document.querySelector('#registration-payment');
  const success = document.querySelector('#registration-success');
  const confirmation = document.querySelector('#payment-confirmed');
  const receiptInput = document.querySelector('#payment-receipt');
  const receiptPreview = document.querySelector('#payment-receipt-preview');
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  let previousFocus;
  let previousOverflow;
  let currentData;
  let currentFingerprint;
  let requestId;
  let busy = false;
  let completed = false;
  let receiptHandle;
  let previewURL;

  function clearReceipt() {
    receiptHandle = null;
    receiptInput.value = '';
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    receiptPreview.removeAttribute('src');
    receiptPreview.hidden = true;
  }

  function validReceipt(file) {
    return file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size > 0 && file.size <= config.maxReceiptBytes;
  }

  receiptInput.addEventListener('change', () => {
    receiptHandle = null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    receiptPreview.removeAttribute('src');
    receiptPreview.hidden = true;
    const file = receiptInput.files[0];
    if (!file) return;
    if (!validReceipt(file)) {
      receiptInput.value = '';
      status.textContent = 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP, tối đa 2 MB.';
      return;
    }
    previewURL = URL.createObjectURL(file);
    receiptPreview.src = previewURL;
    receiptPreview.hidden = false;
    status.textContent = '';
  });

  function receiptData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ mime: file.type, base64: String(reader.result).split(',')[1] });
      reader.onerror = () => reject(new Error('Chưa đọc được ảnh biên lai. Vui lòng chọn lại ảnh.'));
      reader.readAsDataURL(file);
    });
  }

  for (const [name, choices] of Object.entries({ companySize: config.companySizes, stage: config.stages, industry: config.industries, quantity: config.quantities })) {
    const select = form.elements.namedItem(name);
    choices.forEach(value => select.add(new Option(value, value)));
  }
  const industry = form.elements.namedItem('industry');
  const industryOther = form.elements.namedItem('industryOther');
  function updateIndustryOther() {
    const needsDescription = industry.value === 'Khác';
    document.querySelector('#registration-industry-other').hidden = !needsDescription;
    industryOther.disabled = !needsDescription;
    industryOther.required = needsDescription;
    if (!needsDescription) industryOther.value = '';
  }
  industry.addEventListener('change', updateIndustryOther);
  const connections = document.querySelector('#registration-connections');
  config.connections.forEach(value => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'connections';
    input.value = value;
    const text = document.createElement('span');
    text.textContent = value;
    label.append(input, text);
    connections.append(label);
  });
  const connectionsOther = form.elements.namedItem('connectionsOther');
  function updateConnectionsOther() {
    const needsDescription = connections.querySelector('input[value="Khác"]').checked;
    document.querySelector('#registration-connections-other').hidden = !needsDescription;
    connectionsOther.disabled = !needsDescription;
    connectionsOther.required = needsDescription;
    if (!needsDescription) connectionsOther.value = '';
  }
  const privacyChoices = document.querySelector('#registration-privacy-consent');
  config.privacyConsents.forEach(value => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'privacyConsent';
    input.value = value;
    input.required = true;
    const text = document.createElement('span');
    text.textContent = value;
    label.append(input, text);
    privacyChoices.append(label);
  });
  connections.addEventListener('change', () => {
    connections.querySelector('input').setCustomValidity('');
    updateConnectionsOther();
  });

  function showStep(step) {
    information.hidden = step !== 'information';
    payment.hidden = step !== 'payment';
    success.hidden = step !== 'success';
    document.querySelector('#registration-step').textContent = step === 'information' ? '01 / THÔNG TIN THAM DỰ' : step === 'payment' ? '02 / HOÀN TẤT ĐĂNG KÝ' : 'ĐÃ TIẾP NHẬN THÔNG TIN';
    status.textContent = '';
    dialog.scrollTop = 0;
  }

  document.querySelectorAll('[data-registration]').forEach(trigger => trigger.addEventListener('click', event => {
    event.preventDefault();
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    if (completed) {
      form.reset();
      updateIndustryOther();
      updateConnectionsOther();
      currentData = null;
      currentFingerprint = null;
      requestId = null;
      completed = false;
      clearReceipt();
      showStep('information');
    }
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }));
  dialog.querySelectorAll('[data-registration-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow || '';
    previousFocus?.focus();
  });

  async function post(path, data) {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data), signal: AbortSignal.timeout(25000)
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Kết nối đang gián đoạn. Vui lòng thử lại.'); }
    if (!response.ok) throw new Error(result.error || 'Chưa hoàn tất yêu cầu. Vui lòng thử lại.');
    return result;
  }

  function setBusy(value, message = '') {
    busy = value;
    dialog.setAttribute('aria-busy', String(value));
    dialog.querySelectorAll('[data-registration-action]').forEach(button => { button.disabled = value; });
    receiptInput.disabled = value;
    status.textContent = message;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(form);
    const selectedConnections = fields.getAll('connections');
    const firstConnection = connections.querySelector('input');
    firstConnection.setCustomValidity(selectedConnections.length ? '' : 'Vui lòng chọn doanh nghiệp bạn muốn kết nối.');
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(fields);
    data.connections = selectedConnections;
    const fingerprint = JSON.stringify(data);
    if (fingerprint !== currentFingerprint) {
      requestId = crypto.randomUUID();
      currentFingerprint = fingerprint;
      clearReceipt();
    }
    setBusy(true, 'Đang chuẩn bị thông tin đăng ký…');
    try {
      const details = await post('/api/payment', data);
      currentData = data;
      confirmation.checked = false;
      document.querySelector('#payment-name').textContent = data.name;
      document.querySelector('#payment-phone').textContent = data.phone;
      document.querySelector('#payment-amount').textContent = money(details.amount);
      document.querySelector('#payment-bank').textContent = `${details.bank.name} · ${details.bank.account}`;
      document.querySelector('#payment-account-name').textContent = details.bank.accountName;
      document.querySelector('#payment-memo').textContent = details.memo;
      const needsPayment = details.amount > 0;
      document.querySelector('#payment-transfer').hidden = !needsPayment;
      document.querySelector('#payment-exemption').hidden = needsPayment;
      document.querySelector('#payment-exemption').textContent = details.paymentLabel;
      const qrImage = document.querySelector('#payment-qr');
      if (details.qrDataURL) qrImage.src = details.qrDataURL;
      else qrImage.removeAttribute('src');
      document.querySelector('#payment-summary').textContent = needsPayment ? 'Quét QR bằng ứng dụng ngân hàng, hoàn tất chuyển khoản, tải ảnh biên lai và xác nhận bên dưới để gửi đăng ký.' : 'Kiểm tra lại thông tin và gửi đăng ký để Ban Tổ chức tiếp nhận.';
      showStep('payment');
      document.querySelector('#payment-title').focus();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'Kết nối đang chậm. Vui lòng thử lại.' : error.message;
    } finally { setBusy(false, status.textContent); }
  });

  document.querySelector('#registration-back').addEventListener('click', () => {
    if (busy) return;
    currentData = null;
    showStep('information');
    form.elements.namedItem('name').focus();
  });
  document.querySelector('#registration-submit').addEventListener('click', async () => {
    if (busy || !currentData) return;
    if (!document.querySelector('#payment-transfer').hidden && !confirmation.checked) {
      status.textContent = 'Vui lòng xác nhận đã chuyển khoản trước khi gửi đăng ký.';
      confirmation.focus();
      return;
    }
    const needsPayment = !document.querySelector('#payment-transfer').hidden;
    if (needsPayment && !validReceipt(receiptInput.files[0])) {
      status.textContent = 'Vui lòng tải ảnh biên lai JPG, PNG hoặc WEBP, tối đa 2 MB trước khi gửi đăng ký.';
      receiptInput.focus();
      return;
    }
    setBusy(true, 'Đang gửi đăng ký tới Ban Tổ chức…');
    try {
      if (needsPayment && !receiptHandle) {
        status.textContent = 'Đang tải ảnh biên lai…';
        const uploaded = await post('/api/receipt', { ...currentData, requestId, paymentConfirmed: true, receipt: await receiptData(receiptInput.files[0]) });
        if (!uploaded.receiptHandle) throw new Error('Chưa tải được ảnh biên lai. Vui lòng thử lại.');
        receiptHandle = uploaded.receiptHandle;
      }
      status.textContent = 'Đang gửi đăng ký tới Ban Tổ chức…';
      const result = await post('/api/register', { ...currentData, requestId, paymentConfirmed: confirmation.checked, receiptHandle: needsPayment ? receiptHandle : undefined });
      if (result.success !== true) throw new Error('Chưa xác nhận được kết quả gửi đăng ký. Vui lòng thử lại.');
      completed = true;
      clearReceipt();
      showStep('success');
      document.querySelector('#registration-success-title').focus();
    } catch (error) {
      if (error.message.includes('tải lại ảnh biên lai')) receiptHandle = null;
      status.textContent = error.name === 'TimeoutError' ? 'Kết nối đang chậm. Bạn có thể bấm gửi lại để kiểm tra kết quả đăng ký.' : error.message;
    } finally { setBusy(false, status.textContent); }
  });
  document.querySelector('#payment-copy-memo').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#payment-memo').textContent);
      status.textContent = 'Đã sao chép nội dung chuyển khoản.';
    } catch { status.textContent = 'Vui lòng chọn và sao chép nội dung chuyển khoản hiển thị bên trên.'; }
  });
})();
