const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('../registration-config');
const root = path.resolve(__dirname, '..');
const dictionary = Object.assign({}, ...['messages', 'content', 'page'].map(name => JSON.parse(fs.readFileSync(path.join(root, 'locales', `${name}.en.json`), 'utf8'))));

function runtime({ url = 'https://example.com/forum', saved, blockedStorage = false, reducedMotion = false, animationTargets = [] } = {}) {
  const storage = new Map(saved ? [['vmaa-language', saved]] : []);
  const documentEvents = {};
  const formEvents = {};
  const form = { elements: [], addEventListener(name, handler) { formEvents[name] = handler; } };
  const context = {
    window: { VMAA_EN: dictionary, matchMedia() { return { matches: reducedMotion }; } }, URL,
    location: { href: url },
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error('denied'); return storage.get(key); },
      setItem(key, value) { if (blockedStorage) throw new Error('denied'); storage.set(key, value); }
    },
    history: { state: { retained: true }, replaceState(state, title, next) { context.location.href = String(next); this.state = state; } },
    document: { readyState: 'loading', documentElement: { nodeType: 0 }, addEventListener(name, handler) { documentEvents[name] = handler; }, querySelector(selector) { return selector === '#registration-form' ? form : undefined; }, querySelectorAll(selector) { return selector.startsWith('main,footer,') ? animationTargets : []; }, dispatchEvent() {} },
    MutationObserver: class { observe() {} },
    CustomEvent: class {}, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8'), context);
  return { ...context, api: context.window.VMAA_I18N, form, formEvents, initialize: () => documentEvents.DOMContentLoaded() };
}

test('all canonical Lark choices have English labels without changing submitted values', () => {
  const before = JSON.stringify(config);
  const { api } = runtime({ saved: 'en' });
  const values = [...config.companySizes, ...config.stages, ...config.industries, ...config.connections, ...config.quantities, ...config.privacyConsents, ...Object.values(config.paymentLabels)];
  for (const value of values) {
    assert.ok(dictionary[value], value);
    assert.notEqual(api.t(value), value, value);
  }
  assert.equal(JSON.stringify(config), before);
});

test('explicit language beats saved preference and works when storage is blocked', () => {
  assert.equal(runtime({ url: 'https://example.com/?lang=vi', saved: 'en' }).api.language, 'vi');
  assert.equal(runtime({ url: 'https://example.com/?lang=en', blockedStorage: true }).api.language, 'en');
  assert.equal(runtime({ saved: 'en' }).api.language, 'en');
  assert.equal(runtime({ url: 'https://example.com/?lang=invalid', saved: 'invalid' }).api.language, 'vi');
});

test('switching preserves URL context and translates custom validity in both directions', () => {
  const context = runtime({ url: 'https://example.com/forum?campaign=partner#tham-du' });
  const field = { setCustomValidity(value) { this.validationMessage = value; } };
  const original = 'Mã số thuế doanh nghiệp cần gồm 10 số hoặc 13 số.';
  context.api.setValidity(field, original);
  assert.equal(field.validationMessage, original);
  context.api.setLanguage('en');
  assert.equal(field.validationMessage, dictionary[original]);
  assert.equal(new URL(context.location.href).hash, '#tham-du');
  assert.equal(new URL(context.location.href).searchParams.get('campaign'), 'partner');
  assert.equal(new URL(context.location.href).searchParams.get('lang'), 'en');
  assert.equal(context.history.state.retained, true);
  context.api.setLanguage('vi');
  assert.equal(field.validationMessage, original);
  context.api.setValidity(field, '');
  context.api.setLanguage('en');
  assert.equal(field.validationMessage, '');
});

test('translations retain whitespace, unknown names and payment references', () => {
  const { api } = runtime({ saved: 'en' });
  assert.equal(api.t('  Đăng ký tham dự\n'), `  ${dictionary['Đăng ký tham dự']}\n`);
  assert.equal(api.t('Nguyễn Văn A'), 'Nguyễn Văn A');
  assert.equal(api.t('MACF2026 Nguyen Van A 0999999999'), 'MACF2026 Nguyen Van A 0999999999');
});

test('English bundle matches reviewed dictionaries and covers field-specific API errors', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'translations.en.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.VMAA_EN)), dictionary);
  for (const field of ['họ và tên', 'số điện thoại', 'email công việc', 'công ty / tổ chức', 'chức danh']) assert.ok(dictionary[`Vui lòng kiểm tra ${field}.`]);
});

function requiredField(type = 'text', name = 'invoiceName') {
  return { type, name, validity: { customError: false, valueMissing: true }, setCustomValidity(message) { this.validationMessage = message; this.validity.customError = Boolean(message); } };
}

test('programmatic VAT autofill and optional VAT fields can clear only native validation', () => {
  const context = runtime({ saved: 'en' });
  context.initialize();
  const invoice = requiredField();
  context.formEvents.invalid({ target: invoice });
  assert.equal(invoice.validationMessage, 'Please complete this required field.');
  invoice.value = 'Retrieved company';
  invoice.validity.valueMissing = false;
  context.api.clearNativeValidity(invoice);
  assert.equal(invoice.validationMessage, '');
  context.api.setValidity(invoice, 'Mã số thuế doanh nghiệp cần gồm 10 số hoặc 13 số.');
  context.api.clearNativeValidity(invoice);
  assert.equal(invoice.validationMessage, dictionary['Mã số thuế doanh nghiệp cần gồm 10 số hoặc 13 số.']);
});

test('choosing one consent radio clears native errors on its whole group', () => {
  const context = runtime({ saved: 'en' });
  context.initialize();
  const first = requiredField('radio', 'privacyConsent');
  const second = requiredField('radio', 'privacyConsent');
  context.form.elements.push(first, second);
  context.formEvents.invalid({ target: first });
  context.formEvents.invalid({ target: second });
  first.checked = true;
  context.formEvents.change({ target: first });
  assert.equal(first.validationMessage, '');
  assert.equal(second.validationMessage, '');
});

function animationTarget() {
  const animations = [];
  return { animations, animate(frames, options) {
    let resolve;
    let reject;
    const animation = { frames, options, cancelled: false, finished: new Promise((done, fail) => { resolve = done; reject = fail; }), finish() { resolve(); }, cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    animations.push(animation);
    return animation;
  } };
}

test('language transition commits after fade-out and removes animation effects when finished', async () => {
  const target = animationTarget();
  const { api } = runtime({ animationTargets: [target] });
  const request = api.requestLanguage('en');
  assert.equal(api.language, 'vi');
  assert.equal(target.animations[0].options.duration, 90);
  target.animations[0].finish();
  await new Promise(setImmediate);
  assert.equal(api.language, 'en');
  assert.equal(target.animations[1].options.duration, 170);
  target.animations[1].finish();
  await request;
  assert.ok(target.animations.every(animation => animation.cancelled));
});

test('rapid language clicks retain the last choice without a stale delayed switch', async () => {
  const target = animationTarget();
  const { api } = runtime({ animationTargets: [target] });
  const first = api.requestLanguage('en');
  const last = api.requestLanguage('vi');
  await Promise.all([first, last]);
  assert.equal(api.language, 'vi');
  assert.ok(target.animations[0].cancelled);
});

test('reduced motion changes language immediately without starting an animation', async () => {
  const target = animationTarget();
  const { api } = runtime({ reducedMotion: true, animationTargets: [target] });
  const request = api.requestLanguage('en');
  assert.equal(api.language, 'en');
  await request;
  assert.equal(target.animations.length, 0);
});
