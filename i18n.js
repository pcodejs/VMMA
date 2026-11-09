(() => {
  'use strict';
  const dictionary = window.VMAA_EN || {};
  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const validitySources = new Map();
  const nativeValidity = new WeakSet();
  const attributes = ['aria-label', 'alt', 'title', 'placeholder', 'content'];
  const excluded = 'script,style,noscript,textarea,input,[data-i18n-ignore],#payment-name,#payment-phone,#payment-memo,#payment-bank,#payment-account-name';
  let language = 'vi';
  let requested;
  let saved;
  try { requested = new URL(location.href).searchParams.get('lang'); } catch {}
  try { saved = localStorage.getItem('vmaa-language'); } catch {}
  if (requested === 'en' || requested === 'vi') language = requested;
  else if (saved === 'en' || saved === 'vi') language = saved;

  function translate(source) {
    const key = normalize(source);
    if (language !== 'en' || !dictionary[key]) return String(source ?? '');
    return String(source).replace(/\S[\s\S]*\S|\S/, () => dictionary[key]);
  }

  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const current = node.nodeValue;
    const previous = textSources.get(node);
    const source = previous && current === previous.rendered ? previous.source : current;
    const override = node.parentElement.getAttribute('data-i18n-en');
    const rendered = language === 'en' && override && normalize(source) ? source.replace(/\S[\s\S]*\S|\S/, override) : translate(source);
    textSources.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function translateElement(element) {
    if (element.closest(excluded)) return;
    // An option without a value inherits its displayed text. Freeze the original
    // value before translating so Lark receives the same canonical choices.
    if (element.tagName === 'OPTION' && !element.hasAttribute('value')) element.setAttribute('value', element.textContent);
    let sources = attributeSources.get(element);
    if (!sources) { sources = {}; attributeSources.set(element, sources); }
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      // Only descriptions and titles in metadata are copy, never URLs or locale.
      if (name === 'content' && !['description', 'og:title', 'og:description'].includes(element.getAttribute('name') || element.getAttribute('property'))) continue;
      const current = element.getAttribute(name);
      const previous = sources[name];
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = translate(source);
      sources[name] = { source, rendered };
      if (current !== rendered) element.setAttribute(name, rendered);
    }
  }

  function apply(root = document.documentElement) {
    if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateElement(root);
    if (root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateText(node);
      else translateElement(node);
    }
  }

  function setValidity(element, message) {
    if (message) validitySources.set(element, message);
    else validitySources.delete(element);
    element.setCustomValidity(translate(message));
  }

  function clearNativeValidity(element) {
    if (!nativeValidity.has(element)) return;
    nativeValidity.delete(element);
    setValidity(element, '');
  }

  function sourceText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    let result = '';
    while ((node = walker.nextNode())) result += textSources.get(node)?.source ?? node.nodeValue;
    return result;
  }

  function updateSwitches() {
    document.documentElement.lang = language;
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', language === 'en' ? 'en_GB' : 'vi_VN');
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
  }

  function setLanguage(next, persist = true) {
    if (!['vi', 'en'].includes(next)) return;
    language = next;
    if (persist) {
      try { localStorage.setItem('vmaa-language', language); } catch {}
      try {
        const url = new URL(location.href);
        url.searchParams.set('lang', language);
        history.replaceState(history.state, '', url);
      } catch {}
    }
    apply();
    for (const [element, message] of validitySources) element.setCustomValidity(translate(message));
    updateSwitches();
    document.dispatchEvent(new CustomEvent('vmaa:languagechange', { detail: { language } }));
  }

  window.VMAA_I18N = { t: translate, sourceText, setLanguage, setValidity, clearNativeValidity, get language() { return language; }, get locale() { return language === 'en' ? 'en-GB' : 'vi-VN'; } };
  document.documentElement.lang = language;

  function initialize() {
    document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
    setLanguage(language, false);
    // Translate newly rendered agenda, profile dialogs and asynchronous form
    // statuses in place; entered data and DOM/event-handler identity are retained.
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        else if (record.type === 'attributes') translateElement(record.target);
        else for (const node of record.addedNodes) apply(node);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });

    const form = document.querySelector('#registration-form');
    form.addEventListener('invalid', event => {
      const field = event.target;
      if (field.validity.customError) return;
      const message = field.validity.valueMissing ? 'Vui lòng điền hoặc lựa chọn thông tin bắt buộc.' : field.validity.typeMismatch && field.type === 'email' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : 'Vui lòng kiểm tra lại thông tin đã nhập.';
      nativeValidity.add(field);
      setValidity(field, message);
    }, true);
    const clearNative = event => {
      const fields = event.target.type === 'radio' ? [...form.elements].filter(field => field.type === 'radio' && field.name === event.target.name) : [event.target];
      fields.forEach(clearNativeValidity);
    };
    form.addEventListener('input', clearNative, true);
    form.addEventListener('change', clearNative, true);
    form.addEventListener('reset', () => {
      for (const field of form.elements) {
        nativeValidity.delete(field);
        setValidity(field, '');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
