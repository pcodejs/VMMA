(() => {
  'use strict';
  const config = window.VMAA_REGISTRATION_CONFIG;
  const i18n = window.VMAA_I18N;
  const setValidity = (field, message) => i18n.setValidity(field, message);
  const dialog = document.querySelector('#registration-dialog');
  const form = document.querySelector('#registration-form');
  const status = document.querySelector('#registration-status');
  const information = document.querySelector('#registration-information');
  const payment = document.querySelector('#registration-payment');
  const success = document.querySelector('#registration-success');
  const progress = document.querySelector('#registration-progress');
  const progressSteps = progress.querySelectorAll('[data-registration-step]');
  const informationPanels = [...form.querySelectorAll('[data-registration-panel]')];
  const informationBack = document.querySelector('#registration-information-back');
  const nextLabel = document.querySelector('#registration-next-label');
  let informationPanelIndex = 0;
  const confirmation = document.querySelector('#payment-confirmed');
  const receiptInput = document.querySelector('#payment-receipt');
  const receiptPreview = document.querySelector('#payment-receipt-preview');
  const money = value => new Intl.NumberFormat(i18n.locale, { style: 'currency', currency: 'VND' }).format(value);
  let previousFocus;
  let previousOverflow;
  let currentData;
  let currentPaymentAmount;
  let currentFingerprint;
  let requestId;
  let busy = false;
  let completed = false;
  let receiptHandle;
  let previewURL;
  const invoiceTaxCode = form.elements.namedItem('invoiceTaxCode');
  const invoiceName = form.elements.namedItem('invoiceName');
  const invoiceAddress = form.elements.namedItem('invoiceAddress');
  const invoiceRequested = document.querySelector('#registration-invoice-requested');
  const invoiceFields = document.querySelector('#registration-invoice-fields');
  const invoiceLookupButton = document.querySelector('#invoice-lookup-button');
  const invoiceLookupStatus = document.querySelector('#invoice-lookup-status');
  const discountCodeInput = document.querySelector('#discount-code');
  const discountCheckButton = document.querySelector('#discount-check-button');
  const discountCodeStatus = document.querySelector('#discount-code-status');
  let invoiceLookupTimer;
  let invoiceLookupSequence = 0;
  let invoiceLookupController;
  let invoiceLookupPending = false;
  let autoFilledInvoice;
  let discountLookupTimer;
  let discountLookupSequence = 0;
  let discountLookupController;
  let discountLookupPending = false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const motionAnimations = new Map();

  function cancelMotions() {
    motionAnimations.forEach(animation => animation.cancel());
    motionAnimations.clear();
  }

  function playMotion(element, keyframes, duration = 200) {
    if (!dialog.open || !element || typeof element.animate !== 'function') return;
    motionAnimations.get(element)?.cancel();
    const frames = reducedMotion?.matches ? [{ opacity: .72 }, { opacity: 1 }] : keyframes;
    const animation = element.animate(frames, {
      duration: reducedMotion?.matches ? 90 : duration,
      easing: 'cubic-bezier(.16, 1, .3, 1)'
    });
    motionAnimations.set(element, animation);
    animation.finished.catch(() => {}).then(() => {
      if (motionAnimations.get(element) === animation) motionAnimations.delete(element);
    });
  }

  function revealFeedback(element) {
    playMotion(element, [{ opacity: .5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], 180);
  }

  reducedMotion?.addEventListener('change', cancelMotions);

  function validateInvoiceTaxCode() {
    const taxCode = invoiceTaxCode.value.replace(/[\s-]/g, '');
    const valid = /^(?:\d{10}|\d{13})$/.test(taxCode);
    const needsDetails = invoiceRequested.checked && Boolean(taxCode);
    setValidity(invoiceTaxCode, needsDetails && !valid ? 'Mã số thuế doanh nghiệp cần gồm 10 số hoặc 13 số.' : '');
    invoiceName.required = needsDetails;
    invoiceAddress.required = needsDetails;
    return valid;
  }

  function updateInvoiceFields() {
    const requested = invoiceRequested.checked;
    const wasHidden = invoiceFields.hidden;
    if (window.VMAA_DISCLOSURE) window.VMAA_DISCLOSURE.setExpanded(invoiceFields, requested);
    else invoiceFields.hidden = !requested;
    invoiceFields.disabled = busy || !requested;
    invoiceRequested.disabled = busy;
    invoiceRequested.setAttribute('aria-expanded', String(requested));
    if (!requested) {
      cancelInvoiceLookup();
      for (const field of invoiceFields.elements) i18n.clearNativeValidity(field);
    }
    validateInvoiceTaxCode();
    if (requested && wasHidden) revealFeedback(invoiceFields);
  }

  invoiceRequested.addEventListener('change', updateInvoiceFields);

  function cancelInvoiceLookup() {
    clearTimeout(invoiceLookupTimer);
    invoiceLookupSequence++;
    invoiceLookupController?.abort();
    invoiceLookupPending = false;
    invoiceLookupButton.disabled = false;
    invoiceLookupButton.setAttribute('aria-busy', 'false');
    invoiceLookupStatus.textContent = '';
  }

  async function lookupInvoice() {
    if (!invoiceRequested.checked || busy) return;
    cancelInvoiceLookup();
    const taxCode = invoiceTaxCode.value.replace(/[\s-]/g, '');
    if (!/^(?:\d{10}|\d{13})$/.test(taxCode)) {
      invoiceLookupStatus.textContent = 'Vui lòng nhập mã số thuế doanh nghiệp gồm 10 số hoặc 13 số.';
      return;
    }
    invoiceTaxCode.value = taxCode;
    const sequence = invoiceLookupSequence;
    const previousName = invoiceName.value;
    const previousAddress = invoiceAddress.value;
    invoiceLookupController = new AbortController();
    invoiceLookupPending = true;
    invoiceLookupButton.disabled = true;
    invoiceLookupButton.setAttribute('aria-busy', 'true');
    invoiceLookupStatus.textContent = 'Đang tra cứu thông tin doanh nghiệp…';
    try {
      const signal = AbortSignal.any([invoiceLookupController.signal, AbortSignal.timeout(25000)]);
      const company = await post('/api/tax-code', { taxCode }, signal);
      if (sequence !== invoiceLookupSequence) return;
      if (invoiceName.value === previousName) invoiceName.value = company.name;
      if (invoiceAddress.value === previousAddress) invoiceAddress.value = company.address;
      i18n.clearNativeValidity(invoiceName);
      i18n.clearNativeValidity(invoiceAddress);
      autoFilledInvoice = { name: company.name, address: company.address };
      invoiceLookupStatus.textContent = 'Đã lấy thông tin doanh nghiệp. Vui lòng kiểm tra tên và địa chỉ trước khi gửi.';
      revealFeedback(invoiceLookupStatus);
    } catch (error) {
      if (sequence !== invoiceLookupSequence) return;
      invoiceLookupStatus.textContent = 'Chưa tra cứu được thông tin. Vui lòng kiểm tra mã số thuế, thử lại hoặc điền tên và địa chỉ thủ công.';
      revealFeedback(invoiceLookupStatus);
    } finally {
      if (sequence === invoiceLookupSequence) {
        invoiceLookupPending = false;
        invoiceLookupButton.disabled = false;
        invoiceLookupButton.setAttribute('aria-busy', 'false');
        if (status.textContent === i18n.t('Đang tra cứu thông tin hóa đơn. Vui lòng chờ kết quả rồi tiếp tục.')) status.textContent = '';
      }
    }
  }

  invoiceTaxCode.addEventListener('input', () => {
    cancelInvoiceLookup();
    if (autoFilledInvoice) {
      if (invoiceName.value === autoFilledInvoice.name) invoiceName.value = '';
      if (invoiceAddress.value === autoFilledInvoice.address) invoiceAddress.value = '';
      autoFilledInvoice = null;
    }
    const valid = validateInvoiceTaxCode();
    i18n.clearNativeValidity(invoiceName);
    i18n.clearNativeValidity(invoiceAddress);
    if (valid && invoiceRequested.checked) invoiceLookupTimer = setTimeout(lookupInvoice, 700);
  });
  invoiceLookupButton.addEventListener('click', lookupInvoice);
  invoiceTaxCode.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); lookupInvoice(); }
  });
  form.addEventListener('reset', () => {
    cancelInvoiceLookup();
    autoFilledInvoice = null;
    invoiceRequested.checked = false;
    updateInvoiceFields();
  });
  updateInvoiceFields();

  function cancelDiscountLookup() {
    clearTimeout(discountLookupTimer);
    discountLookupSequence++;
    discountLookupController?.abort();
    discountLookupPending = false;
    discountCheckButton.disabled = false;
    discountCheckButton.setAttribute('aria-busy', 'false');
  }

  function resetDiscountStatus() {
    cancelDiscountLookup();
    discountCodeStatus.removeAttribute('data-i18n-en');
    discountCodeStatus.textContent = '';
    discountCodeStatus.dataset.state = '';
  }

  async function lookupDiscount() {
    if (busy) return;
    cancelDiscountLookup();
    discountCodeStatus.removeAttribute('data-i18n-en');
    const code = discountCodeInput.value.trim();
    if (!code) {
      discountCodeStatus.textContent = '';
      discountCodeStatus.dataset.state = '';
      return;
    }
    const sequence = discountLookupSequence;
    discountLookupController = new AbortController();
    discountLookupPending = true;
    discountCheckButton.disabled = true;
    discountCheckButton.setAttribute('aria-busy', 'true');
    discountCodeStatus.dataset.state = 'pending';
    discountCodeStatus.textContent = 'Đang kiểm tra mã…';
    try {
      const signal = AbortSignal.any([discountLookupController.signal, AbortSignal.timeout(12000)]);
      const result = await post('/api/discount', { code }, signal);
      if (sequence !== discountLookupSequence) return;
      discountCodeInput.value = result.code;
      discountCodeStatus.dataset.state = 'valid';
      discountCodeStatus.setAttribute('data-i18n-en', `Great! Your partner discount has been confirmed 🎉\n${result.code} — ${result.partner}\nYour special rate: VND ${new Intl.NumberFormat('en-GB').format(result.unitPrice)} per ticket`);
      discountCodeStatus.textContent = result.message;
      revealFeedback(discountCodeStatus);
    } catch (error) {
      if (sequence !== discountLookupSequence) return;
      discountCodeStatus.dataset.state = 'invalid';
      discountCodeStatus.textContent = error.name === 'TimeoutError' ? 'Chưa kiểm tra được mã. Vui lòng thử lại.' : error.message;
      revealFeedback(discountCodeStatus);
    } finally {
      if (sequence === discountLookupSequence) {
        discountLookupPending = false;
        discountCheckButton.disabled = false;
        discountCheckButton.setAttribute('aria-busy', 'false');
      }
    }
  }

  discountCodeInput.addEventListener('input', () => {
    cancelDiscountLookup();
    discountCodeStatus.removeAttribute('data-i18n-en');
    discountCodeStatus.textContent = '';
    discountCodeStatus.dataset.state = '';
    clearTimeout(discountLookupTimer);
    if (discountCodeInput.value.trim()) discountLookupTimer = setTimeout(lookupDiscount, 450);
  });
  discountCodeInput.addEventListener('blur', lookupDiscount);
  discountCodeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); lookupDiscount(); }
  });
  discountCheckButton.addEventListener('click', lookupDiscount);
  form.addEventListener('reset', resetDiscountStatus);

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
    revealFeedback(receiptPreview);
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
  const title = form.elements.namedItem('title');
  const titleOther = form.elements.namedItem('titleOther');
  function updateTitleOther() {
    const needsDescription = title.value === 'Khác';
    document.querySelector('#registration-title-other').hidden = !needsDescription;
    titleOther.disabled = !needsDescription;
    titleOther.required = needsDescription;
    if (!needsDescription) titleOther.value = '';
  }
  title.addEventListener('change', updateTitleOther);
  const quantity = form.elements.namedItem('quantity');
  const companions = form.elements.namedItem('companions');
  function updateCompanions() {
    const needsList = Boolean(quantity.value) && quantity.value !== config.quantities[0];
    document.querySelector('#registration-companions').hidden = !needsList;
    companions.disabled = !needsList;
    companions.required = needsList;
  }
  quantity.addEventListener('change', updateCompanions);
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
    label.className = 'registration-choice';
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
    label.className = 'registration-choice';
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
    setValidity(connections.querySelector('input'), '');
    updateConnectionsOther();
  });

  function showStep(step, panelIndex = informationPanelIndex) {
    const previousIndex = payment.hidden ? informationPanelIndex : 3;
    informationPanelIndex = panelIndex;
    information.hidden = step !== 'information';
    payment.hidden = step !== 'payment';
    success.hidden = step !== 'success';
    progress.hidden = step === 'success';
    const activeIndex = step === 'payment' ? 3 : informationPanelIndex;
    informationPanels.forEach((panel, index) => { panel.hidden = index !== informationPanelIndex; });
    informationBack.hidden = informationPanelIndex === 0;
    nextLabel.textContent = informationPanelIndex < 2 ? 'Tiếp tục' : 'Tiếp tục đến bước xác nhận';
    progressSteps.forEach((item, index) => {
      const active = index === activeIndex;
      if (active) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.dataset.complete = String(index < activeIndex);
    });
    const descriptions = ['Bước 1 / 4 · Thông tin liên hệ', 'Bước 2 / 4 · Doanh nghiệp và kết nối', 'Bước 3 / 4 · Vé tham dự', 'Bước 4 / 4 · Xác nhận đăng ký'];
    document.querySelector('#registration-step').textContent = step === 'success' ? 'ĐÃ TIẾP NHẬN THÔNG TIN' : descriptions[activeIndex];
    status.textContent = '';
    dialog.scrollTop = 0;
    if (step === 'success') revealFeedback(success);
    else {
      const panel = step === 'payment' ? payment : informationPanels[informationPanelIndex];
      const offset = activeIndex >= previousIndex ? 12 : -12;
      playMotion(panel, [{ opacity: .45, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'translateX(0)' }], 220);
    }
  }

  function focusPanelHeading() {
    const heading = informationPanels[informationPanelIndex].querySelector('legend');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  function validatePanel(panel) {
    for (const field of panel.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea')) {
      if (!field.disabled && field.type !== 'file') field.value = field.value.trim();
    }
    if (panel.dataset.registrationPanel === 'contact') {
      const phone = form.elements.namedItem('phone');
      const normalizedPhone = phone.value.replace(/[\s().-]/g, '');
      setValidity(phone, normalizedPhone && !/^(?:\+?[1-9]\d{7,14}|0\d{8,10})$/.test(normalizedPhone) ? 'Số điện thoại chưa đúng định dạng.' : '');
    }
    if (panel.dataset.registrationPanel === 'company') {
      setValidity(connections.querySelector('input'), connections.querySelector('input:checked') ? '' : 'Vui lòng chọn doanh nghiệp bạn muốn kết nối.');
    }
    const invalid = [...panel.querySelectorAll('input, select, textarea')].find(field => field.willValidate && !field.validity.valid);
    if (invalid) { invalid.reportValidity(); return false; }
    return true;
  }

  informationBack.addEventListener('click', () => {
    if (busy || informationPanelIndex === 0) return;
    showStep('information', informationPanelIndex - 1);
    focusPanelHeading();
  });
  form.elements.namedItem('phone').addEventListener('input', () => setValidity(form.elements.namedItem('phone'), ''));

  document.querySelectorAll('[data-registration]').forEach(trigger => trigger.addEventListener('click', event => {
    event.preventDefault();
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    if (completed) {
      form.reset();
      updateTitleOther();
      updateCompanions();
      updateIndustryOther();
      updateConnectionsOther();
      currentData = null;
      currentFingerprint = null;
      requestId = null;
      completed = false;
      clearReceipt();
      showStep('information', 0);
    }
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }));
  dialog.querySelectorAll('[data-registration-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    cancelMotions();
    document.body.style.overflow = previousOverflow || '';
    previousFocus?.focus();
  });

  async function post(path, data, signal = AbortSignal.timeout(25000)) {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data), signal
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Kết nối đang gián đoạn. Vui lòng thử lại.'); }
    if (!response.ok) throw new Error(result.error || 'Chưa hoàn tất yêu cầu. Vui lòng thử lại.');
    return result;
  }

  function setBusy(value, message) {
    busy = value;
    dialog.setAttribute('aria-busy', String(value));
    dialog.querySelectorAll('[data-registration-action]').forEach(button => { button.disabled = value; });
    receiptInput.disabled = value;
    discountCodeInput.disabled = value;
    discountCheckButton.disabled = value || discountLookupPending;
    updateInvoiceFields();
    if (message !== undefined) status.textContent = message;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!validatePanel(informationPanels[informationPanelIndex])) return;
    if (informationPanelIndex < informationPanels.length - 1) {
      showStep('information', informationPanelIndex + 1);
      focusPanelHeading();
      return;
    }
    if (invoiceLookupPending) {
      status.textContent = 'Đang tra cứu thông tin hóa đơn. Vui lòng chờ kết quả rồi tiếp tục.';
      return;
    }
    const fields = new FormData(form);
    const selectedConnections = fields.getAll('connections');
    const firstConnection = connections.querySelector('input');
    setValidity(firstConnection, selectedConnections.length ? '' : 'Vui lòng chọn doanh nghiệp bạn muốn kết nối.');
    const invalidPanel = informationPanels.findIndex(panel => ![...panel.querySelectorAll('input, select, textarea')].every(field => !field.willValidate || field.validity.valid));
    if (invalidPanel !== -1) {
      showStep('information', invalidPanel);
      validatePanel(informationPanels[invalidPanel]);
      return;
    }
    cancelInvoiceLookup();
    const data = Object.fromEntries(fields);
    if (data.title === 'Khác') data.title = data.titleOther.trim();
    delete data.titleOther;
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
      currentPaymentAmount = details.amount;
      document.querySelector('#payment-amount').textContent = money(details.amount);
      document.querySelector('#payment-bank').textContent = `${details.bank.name} · ${details.bank.account}`;
      document.querySelector('#payment-account-name').textContent = details.bank.accountName;
      document.querySelector('#payment-memo').textContent = details.memo;
      const paymentDiscountRow = document.querySelector('#payment-discount-row');
      const paymentDiscount = document.querySelector('#payment-discount');
      if (details.discount) {
        paymentDiscountRow.hidden = false;
        paymentDiscount.textContent = `${details.discount.code} — ${details.discount.partner} · Giá ưu đãi: ${money(details.discount.unitPrice)}/vé`;
      } else {
        paymentDiscountRow.hidden = true;
        paymentDiscount.textContent = '';
      }
      const needsPayment = details.amount > 0;
      document.querySelector('#payment-title').textContent = needsPayment ? 'Thanh toán và xác nhận' : 'Xác nhận thông tin tham dự';
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
    } finally { setBusy(false); }
  });

  document.querySelector('#registration-back').addEventListener('click', () => {
    if (busy) return;
    currentData = null;
    showStep('information', informationPanels.length - 1);
    focusPanelHeading();
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
    } finally { setBusy(false); }
  });
  document.addEventListener('vmaa:languagechange', () => {
    if (currentPaymentAmount !== undefined) document.querySelector('#payment-amount').textContent = money(currentPaymentAmount);
  });
  document.querySelector('#payment-copy-memo').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#payment-memo').textContent);
      status.textContent = 'Đã sao chép nội dung chuyển khoản.';
    } catch { status.textContent = 'Vui lòng chọn và sao chép nội dung chuyển khoản hiển thị bên trên.'; }
  });
})();
