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
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  let previousFocus;
  let previousOverflow;
  let currentData;
  let currentFingerprint;
  let requestId;
  let busy = false;
  let completed = false;

  for (const [name, choices] of Object.entries({ companySize: config.companySizes, stage: config.stages, industry: config.industries, quantity: config.quantities })) {
    const select = form.elements.namedItem(name);
    choices.forEach(value => select.add(new Option(value, value)));
  }
  const sessions = document.querySelector('#registration-sessions');
  config.sessions.forEach(value => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'sessions';
    input.value = value;
    const text = document.createElement('span');
    text.textContent = value;
    label.append(input, text);
    sessions.append(label);
  });
  sessions.addEventListener('change', event => {
    const inputs = [...sessions.querySelectorAll('input')];
    inputs[0].setCustomValidity('');
    if (event.target.checked && event.target === inputs[0]) inputs.slice(1).forEach(input => { input.checked = false; });
    else if (event.target.checked) inputs[0].checked = false;
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
      currentData = null;
      currentFingerprint = null;
      requestId = null;
      completed = false;
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
    status.textContent = message;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(form);
    const selectedSessions = fields.getAll('sessions');
    const firstSession = sessions.querySelector('input');
    firstSession.setCustomValidity(selectedSessions.length ? '' : 'Vui lòng chọn phiên muốn tham dự.');
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(fields);
    data.sessions = selectedSessions;
    const fingerprint = JSON.stringify(data);
    if (fingerprint !== currentFingerprint) {
      requestId = crypto.randomUUID();
      currentFingerprint = fingerprint;
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
      document.querySelector('#payment-qr').src = details.qrDataURL || '';
      document.querySelector('#payment-summary').textContent = needsPayment ? 'Quét QR bằng ứng dụng ngân hàng, hoàn tất chuyển khoản và xác nhận bên dưới để gửi đăng ký.' : 'Kiểm tra lại thông tin và gửi đăng ký để Ban Tổ chức tiếp nhận.';
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
    setBusy(true, 'Đang gửi đăng ký tới Ban Tổ chức…');
    try {
      const result = await post('/api/register', { ...currentData, requestId, paymentConfirmed: confirmation.checked });
      if (result.success !== true) throw new Error('Chưa xác nhận được kết quả gửi đăng ký. Vui lòng thử lại.');
      completed = true;
      showStep('success');
      document.querySelector('#registration-success-title').focus();
    } catch (error) {
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
