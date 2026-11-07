(() => {
  'use strict';
  const content = window.VMAA_CONTENT;
  if (!content) return;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const intro = $('#hero-intro');
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finishIntro = () => {
    if(!root.classList.contains('intro-pending')) return;
    const skipHadFocus = document.activeElement === intro.querySelector('.intro-skip');
    root.classList.remove('intro-pending','intro-running');
    if(skipHadFocus) $('.brand').focus({preventScroll:true});
  };
  if(root.classList.contains('intro-pending')) {
    intro.querySelector('.intro-skip').addEventListener('click',finishIntro);
    intro.querySelector('.intro-panel-left').addEventListener('animationend',e => {
      if(e.target === e.currentTarget && e.animationName === 'intro-open-left') finishIntro();
    });
    const introImage = new Image();
    introImage.src = 'assets/key-visual.png';
    Promise.all([introImage.decode(),document.fonts.ready]).then(() => {
      if(root.classList.contains('intro-pending')) {
        root.classList.add('intro-running');
        setTimeout(finishIntro,2700);
      }
    }).catch(finishIntro);
    const onIntroKey = e => {
      if(e.key === 'Escape' || e.key === 'Tab') finishIntro();
    };
    document.addEventListener('keydown',onIntroKey);
    setTimeout(() => {
      finishIntro();
      document.removeEventListener('keydown',onIntroKey);
    },9500);
    reducedMotion.addEventListener('change',e => { if(e.matches) finishIntro(); });
    window.addEventListener('pageshow',e => { if(e.persisted) finishIntro(); });
  }
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = (value) => {
    if (!value) return '';
    try { const u = new URL(value, location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  };
  const safeImageUrl = value => /^assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|svg)$/i.test(value || '') ? value : safeUrl(value);

  const nav = $('#main-nav');
  const menu = $('.menu-toggle');
  const closeMenu = () => { nav.classList.remove('is-open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Mở menu'); };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    nav.classList.toggle('is-open',open);
  });
  $$('.main-nav a').forEach(a => a.addEventListener('click', closeMenu));
  $('.header-registration').addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', e => { if(!$('#site-header').contains(e.target)) closeMenu(); });
  window.matchMedia('(min-width:721px)').addEventListener('change', e => { if(e.matches) closeMenu(); });

  let scrolled = false;
  const onScroll = () => {
    if(scrolled) return;
    scrolled = true;
    requestAnimationFrame(() => {
      $('#site-header').classList.toggle('is-scrolled',scrollY > 180);
      scrolled = false;
    });
  };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  const takeawayList = $('.takeaways-interactive .takeaway-list');
  if(takeawayList) {
    const takeawayItems = [...takeawayList.querySelectorAll('.takeaway-item')];
    const takeawayPreviewImages = $$('[data-takeaway-preview]');
    const setTakeaway = selected => {
      const index = Math.max(0,takeawayItems.indexOf(selected));
      takeawayItems.forEach((item,i) => {
        const active = i === index;
        item.classList.toggle('is-active',active);
        item.querySelector('.takeaway-trigger').setAttribute('aria-pressed',String(active));
      });
      takeawayPreviewImages.forEach((image,i) => image.classList.toggle('is-active',i === index));
      $('.takeaway-preview-index').textContent = `${String(index+1).padStart(2,'0')} / ${String(takeawayItems.length).padStart(2,'0')}`;
      $('.takeaway-preview-title').textContent = takeawayItems[index].querySelector('.takeaway-trigger').textContent.trim();
    };
    setTakeaway(takeawayItems[0]);
    takeawayItems.forEach(item => {
      const trigger = item.querySelector('.takeaway-trigger');
      item.addEventListener('pointerenter',event => {
        if(event.pointerType === 'mouse') setTakeaway(item);
      });
      trigger.addEventListener('focus',() => {
        if(trigger.matches(':focus-visible')) setTakeaway(item);
      });
      trigger.addEventListener('click',() => setTakeaway(item));
    });
  }

  function renderAgenda(filter = 'all') {
    const rows = content.agenda.filter(row => filter === 'all' || row.category === filter);
    $('#agenda-list').innerHTML = rows.map(row => `
      <article class="agenda-row${row.featured ? ' featured' : ''}${row.category === 'connect' ? ' connection' : ''}">
        <div class="agenda-time">
          <time datetime="2026-12-13T${escape(row.start)}:00+07:00">${escape(row.start)}</time>
          <span>— <time datetime="2026-12-13T${escape(row.end)}:00+07:00">${escape(row.end)}</time></span>
        </div>
        <div class="agenda-session">
          <span class="micro">${[...new Set([row.kind, row.format].filter(Boolean))].map(escape).join(' · ')}</span>
          <h3>${escape(row.title)}</h3>
          ${row.detail ? `<p>${escape(row.detail)}</p>` : ''}
          ${row.objectives?.length ? `
            <details class="agenda-objectives">
              <summary>Xem mục tiêu phiên</summary>
              <ul>${row.objectives.map(objective => `<li>${escape(objective)}</li>`).join('')}</ul>
            </details>` : ''}
        </div>
      </article>`).join('');
  }
  renderAgenda();
  $$('[data-filter]').forEach(button => button.addEventListener('click',() => {
    $$('[data-filter]').forEach(other => { const active = other === button; other.classList.toggle('active',active); other.setAttribute('aria-pressed',String(active)); });
    renderAgenda(button.dataset.filter);
  }));

  const target = content.event.registrationDeadline ? new Date(content.event.registrationDeadline).getTime() : NaN;
  const hasRegistrationDeadline = Number.isFinite(target);
  $('.countdown-bar').hidden = !hasRegistrationDeadline;
  $('#registration-countdown').hidden = !hasRegistrationDeadline;
  $('#countdown-pending').hidden = hasRegistrationDeadline;
  const pad = value => String(value).padStart(2,'0');
  let countdownInterval;
  function updateCountdown() {
    if(!hasRegistrationDeadline) {
      $('#countdown-label').textContent = 'Hạn đăng ký sẽ được Ban Tổ chức công bố.';
      return;
    }
    const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
    $('#days').textContent = pad(Math.floor(seconds / 86400));
    $('#hours').textContent = pad(Math.floor(seconds / 3600) % 24);
    $('#minutes').textContent = pad(Math.floor(seconds / 60) % 60);
    $('#seconds').textContent = pad(seconds % 60);
    $('#countdown-label').textContent = 'Thời gian còn lại đến hạn đăng ký';
    if(seconds === 0) { $('#countdown-label').textContent = 'Đã hết thời gian đăng ký'; if(countdownInterval) clearInterval(countdownInterval); }
  }
  updateCountdown();
  if(hasRegistrationDeadline && target > Date.now()) countdownInterval = setInterval(updateCountdown,1000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) updateCountdown(); });

  let toastTimeout;
  function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('visible'), 4800); }
  const icsEscape = value => String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const icsDate = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  function downloadCalendar() {
    const description = `Khơi thông nguồn lực. Kiến tạo tăng trưởng mới. Địa điểm cụ thể đang được cập nhật. ${content.tickets.note} Liên hệ ${content.contact.name}: ${content.contact.phone} · ${content.links.contactEmail}. Thông tin xác nhận tham dự do Ban Tổ chức gửi qua email.`;
    const events = [{id:'forum',name:content.event.name,start:content.event.start,end:content.event.end}];
    if(content.event.dinnerStart && content.event.dinnerEnd) events.push({id:'dinner',name:'Tiệc ra mắt và kết nối cộng đồng M&A Miền Trung',start:content.event.dinnerStart,end:content.event.dinnerEnd});
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VMAA//Central Vietnam Forum 2026//VI','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events.flatMap(event => ['BEGIN:VEVENT',`UID:vmaa-mientrung-2026-${event.id}@vmaa-forum.local`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${icsDate(event.start)}`,`DTEND:${icsDate(event.end)}`,`SUMMARY:${icsEscape(event.name)}`,`LOCATION:${icsEscape(content.event.venue || content.event.location)}`,`DESCRIPTION:${icsEscape(description)}`,'STATUS:TENTATIVE','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(event.name)}`,'END:VALARM','END:VEVENT']),'END:VCALENDAR'];
    // RFC 5545: fold long UTF-8 content lines at 75 octets, without splitting code points.
    const foldLine = line => { const encoder = new TextEncoder(); let result = '', part = ''; for(const char of line) { if(encoder.encode(part + char).length > 75) { result += part + '\r\n'; part = ' '; } part += char; } return result + part; };
    const blob = new Blob([lines.map(foldLine).join('\r\n')+'\r\n'], {type:'text/calendar;charset=utf-8'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'VMAA-Mien-Trung-2026.ics'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    toast('Đã tải lịch sự kiện. Mở tệp để thêm vào ứng dụng Lịch.');
  }
  $$('[data-calendar]').forEach(button => button.addEventListener('click', downloadCalendar));

  const dialog = $('#info-dialog');
  let previousFocus;
  function openInfo(mode = 'speaker', speaker) {
    previousFocus = document.activeElement;
    const isSpeaker = mode === 'speaker';
    dialog.classList.toggle('is-speaker', isSpeaker);
    $('#dialog-speaker').hidden = !isSpeaker;
    dialog.querySelector('.dialog-event').hidden = isSpeaker;
    dialog.querySelector('[data-calendar]').hidden = isSpeaker;
    $('#dialog-speaker').replaceChildren();
    if(mode === 'speaker') {
      $('#dialog-title').textContent = speaker.name;
      const isDraft = content.speakersStatus === 'draft';
      $('#dialog-description').textContent = isDraft ? 'Hồ sơ dự kiến · Thông tin đang được Ban Tổ chức xác nhận.' : 'Thông tin khách mời / diễn giả';
      const image = safeImageUrl(speaker.image);
      $('#dialog-speaker').innerHTML = `${image ? `<div class="dialog-portrait${speaker.imageStyle === 'portfolio' ? ' portfolio-portrait' : speaker.imageStyle === 'framed' ? ' framed' : ''}"><img src="${escape(image)}" alt="Chân dung ${escape(speaker.name)}"></div>` : ''}<div class="dialog-speaker-copy"><dl><div><dt>Chức danh</dt><dd>${escape(speaker.title || 'Đang cập nhật')}</dd></div><div><dt>Doanh nghiệp / tổ chức</dt><dd>${escape(speaker.organization || 'Đang cập nhật')}</dd></div><div><dt>Vai trò tại diễn đàn</dt><dd>${escape(speaker.forumRole || 'Đang cập nhật')}${isDraft ? ' <span>· Dự kiến</span>' : ''}</dd></div></dl><h3>Sơ lược tiểu sử</h3><p>${escape(speaker.bio || 'Tiểu sử đang được cập nhật.')}</p></div>`;
    }
    dialog.showModal(); document.body.style.overflow = 'hidden';
  }
  function closeInfo() { dialog.close(); }
  $('.dialog-close').addEventListener('click',closeInfo);
  $('.dialog-dismiss').addEventListener('click',closeInfo);
  dialog.addEventListener('click', e => { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeInfo(); });
  dialog.addEventListener('close',() => { document.body.style.overflow = ''; previousFocus?.focus(); });


  if(content.tickets.price !== null) { $('#ticket-price').textContent = new Intl.NumberFormat('vi-VN',{style:'currency',currency:content.tickets.currency}).format(content.tickets.price); $('#ticket-status').textContent = 'VÉ THAM DỰ'; }
  $('#ticket-note').textContent = content.tickets.note;
  $('#ticket-dinner-note').textContent = content.tickets.dinnerNote;
  $('#registration-fee-price').textContent = content.tickets.registrationPrice;
  $('#registration-fee-dinner').textContent = content.tickets.registrationDinner;
  if(content.event.venue) $('#venue-note').textContent = content.event.venue;

  if(content.speakers.length) {
    $('#speaker-list').classList.toggle('speaker-list-five',content.speakers.length === 5);
    $('#speaker-pending').hidden = true;
    $('#speaker-draft-notice').hidden = content.speakersStatus !== 'draft';
    $('#speaker-count').textContent = `${content.speakers.length} hồ sơ`;
    content.speakers.forEach((speaker, index) => {
      const card = document.createElement('article'); card.className = 'speaker-card';
      const image = safeImageUrl(speaker.image);
      card.innerHTML = `<div class="speaker-portrait${speaker.imageStyle === 'portfolio' ? ' portfolio-portrait' : speaker.imageStyle === 'framed' ? ' framed' : ''}">${image ? `<img src="${escape(image)}" alt="Chân dung ${escape(speaker.name)}" loading="lazy" decoding="async">` : ''}</div><div class="speaker-copy"><h3>${escape(speaker.name)}</h3><div class="speaker-meta"><p class="speaker-title">${escape(speaker.title)}</p><p class="speaker-organization">${escape(speaker.organization)}</p></div><span class="speaker-role">${escape(speaker.forumRole || 'Vai trò đang cập nhật')}${content.speakersStatus === 'draft' ? ' · Dự kiến' : ''}</span><p class="speaker-bio">${escape(speaker.bio || 'Tiểu sử đang được cập nhật.')}</p><button aria-label="Xem hồ sơ ${escape(speaker.name)}" aria-haspopup="dialog">Xem hồ sơ <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span></button></div>`;
      card.querySelector('button').addEventListener('click',() => openInfo('speaker',speaker)); $('#speaker-list').append(card);
    });
  }
  if(content.partners.length) {
    $('#partner-announcement').hidden = true;
    const partnerGroups = [
      ['diamond', 'Nhà tài trợ Kim cương'],
      ['gold', 'Nhà tài trợ Vàng'],
      ['bronze', 'Nhà tài trợ Đồng'],
      ['strategic', 'Đối tác chiến lược'],
      ['companion', 'Đơn vị đồng hành']
    ];
    partnerGroups.forEach(([tier, label]) => {
      const partners = content.partners.filter(partner => partner.tier === tier);
      if (!partners.length) return;
      const group = document.createElement('section');
      group.className = `sponsor-group sponsor-group-${tier}`;
      group.setAttribute('aria-labelledby', `sponsor-heading-${tier}`);
      group.innerHTML = `<h3 id="sponsor-heading-${tier}">${escape(label)}</h3><div class="sponsor-logo-grid"></div>`;
      partners.forEach(partner => {
        const node = document.createElement('div');
        node.className = 'sponsor-logo';
        const logo = safeImageUrl(partner.logo);
        node.innerHTML = logo ? `<img src="${escape(logo)}" alt="${escape(partner.name)}" width="400" height="160" loading="lazy" decoding="async">` : `<p>${escape(partner.name)}</p>`;
        const url = safeUrl(partner.url);
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.append(node);
          group.querySelector('.sponsor-logo-grid').append(link);
        } else group.querySelector('.sponsor-logo-grid').append(node);
      });
      $('#partner-list').append(group);
    });
  }

  if(content.sponsorship) {
    const money = value => new Intl.NumberFormat('vi-VN').format(value) + ' đ';
    $('#sponsorship-tiers').innerHTML = content.sponsorship.tiers.map((tier,index) => `<article class="sponsorship-tier${index === 0 ? ' sponsorship-tier-lead' : ''}"><span class="micro">HẠNG TÀI TRỢ ${String(index+1).padStart(2,'0')}</span><h4>${escape(tier.name)}</h4><p class="tier-price">${escape(money(tier.price))}</p><p class="tier-note">${escape(tier.note)}</p><ul>${tier.highlights.map(item => `<li>${escape(item)}</li>`).join('')}</ul><a href="#lien-he" class="text-link">Trao đổi hợp tác <span aria-hidden="true">→</span></a></article>`).join('');
    $('#sponsorship-tables').innerHTML = content.sponsorship.groups.map((group,index) => `<section class="sponsorship-table-group" aria-labelledby="sponsorship-group-${index}"><h4 id="sponsorship-group-${index}">${escape(group.title)} <span>${escape(group.subtitle)}</span></h4><div class="sponsor-table-scroll" role="region" aria-label="Quyền lợi ${escape(group.title.toLowerCase())}" tabindex="0"><table><caption class="sr-only">So sánh quyền lợi ${escape(group.title.toLowerCase())}</caption><thead><tr><th scope="col">Hạng mục quyền lợi</th>${content.sponsorship.tiers.map(tier => `<th scope="col">${escape(tier.name)}<small>${escape(money(tier.price))}</small></th>`).join('')}</tr></thead><tbody>${group.rows.map(row => `<tr><th scope="row">${escape(row[0])}</th>${row.slice(1).map(cell => `<td>${cell === '—' ? '<span aria-label="Không bao gồm">—</span>' : escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('');
  }

  if('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting) { $$('.main-nav a').forEach(a => a.classList.toggle('active',a.hash === '#'+entry.target.id)); } }), {rootMargin:'-10% 0px -65% 0px'});
    $$('main section[id]').forEach(section => navObserver.observe(section));
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches) {
      const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting) {entry.target.classList.add('visible'); revealObserver.unobserve(entry.target);} }),{threshold:0.06});
      $$('.section-heading,.overview-layout,.speaker-pending,.topic-card,.audience-grid,.takeaway-layout,.partner-benefits,.registration-layout').forEach(el => {el.classList.add('reveal'); revealObserver.observe(el);});
    }
  }
})();
