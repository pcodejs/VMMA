(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const transitions = new Map();

  function applyExpanded(element, expanded) {
    if (element.tagName === 'DETAILS') element.open = expanded;
    else element.hidden = !expanded;
  }

  function finish(element) {
    const transition = transitions.get(element);
    if (!transition) return;
    transitions.delete(element);
    applyExpanded(element, transition.expanded);
    transition.animation.cancel();
    element.style.overflow = transition.overflow;
    element.removeAttribute('data-disclosure-expanded');
  }

  function finishAll() {
    [...transitions.keys()].forEach(finish);
  }

  function setExpanded(element, expanded) {
    const previous = transitions.get(element);
    const isDetails = element.tagName === 'DETAILS';
    const currentlyExpanded = isDetails ? element.open : !element.hidden;
    if (previous ? previous.expanded === expanded : currentlyExpanded === expanded) return;

    const startHeight = element.getBoundingClientRect().height;
    const startStyle = getComputedStyle(element);
    const startMarginTop = currentlyExpanded ? startStyle.marginTop : '0px';
    const startMarginBottom = currentlyExpanded ? startStyle.marginBottom : '0px';
    const startClip = startStyle.clipPath;
    const overflow = previous ? previous.overflow : element.style.overflow;
    if (previous) {
      transitions.delete(element);
      previous.animation.cancel();
    }
    element.style.overflow = overflow;

    if (reducedMotion.matches || typeof element.animate !== 'function') {
      applyExpanded(element, expanded);
      element.removeAttribute('data-disclosure-expanded');
      return;
    }

    // Measure both native states before painting, then keep content available
    // until its closing transition finishes.
    applyExpanded(element, false);
    const collapsedHeight = element.getBoundingClientRect().height;
    applyExpanded(element, true);
    const expandedHeight = element.getBoundingClientRect().height;
    const expandedStyle = getComputedStyle(element);
    const from = { height: `${startHeight}px` };
    const to = { height: `${expanded ? expandedHeight : collapsedHeight}px` };
    if (!isDetails) {
      from.marginTop = startMarginTop;
      from.marginBottom = startMarginBottom;
      to.marginTop = expanded ? expandedStyle.marginTop : '0px';
      to.marginBottom = expanded ? expandedStyle.marginBottom : '0px';
    } else if (Math.abs(expandedHeight - collapsedHeight) < 1) {
      // Shared grid rows can reserve the same height for open and closed cards.
      const summary = element.querySelector(':scope > summary');
      const summaryHeight = summary.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
      const clipped = `inset(0 0 ${Math.max(0, expandedHeight - summaryHeight)}px 0)`;
      const revealed = 'inset(0 0 0px 0)';
      from.clipPath = previous ? startClip : expanded ? clipped : revealed;
      to.clipPath = expanded ? revealed : clipped;
    }

    element.style.overflow = 'clip';
    element.dataset.disclosureExpanded = String(expanded);
    const animation = element.animate([from, to], {
      duration: expanded ? 260 : 200,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'both'
    });
    transitions.set(element, { animation, expanded, overflow });
    animation.finished.then(() => {
      if (transitions.get(element)?.animation === animation) finish(element);
    }).catch(() => {});
  }

  // Delegation also covers programme details recreated by the filter buttons.
  document.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    if (!summary || summary.parentElement.tagName !== 'DETAILS' || event.defaultPrevented) return;
    if (event.target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();
    const details = summary.parentElement;
    const expanded = transitions.get(details)?.expanded ?? details.open;
    setExpanded(details, !expanded);
  });

  window.addEventListener('resize', finishAll, { passive: true });
  window.addEventListener('pagehide', finishAll);
  reducedMotion.addEventListener('change', finishAll);
  document.addEventListener('vmaa:languagechange', finishAll);
  document.addEventListener('close', event => {
    [...transitions.keys()].forEach(element => {
      if (event.target.contains(element)) finish(element);
    });
  }, true);

  window.VMAA_DISCLOSURE = { setExpanded };
})();
