/* ============================================================================
   SHIRUN ATELIER — 交互层（零依赖）
   1) 导航滚动收紧  2) 移动抽屉  3) 滚动显现  4) 玻璃镜头高光  5) 会员卡微倾斜
   全部尊重 prefers-reduced-motion；无 JS 时页面内容完整可读。
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var nav = document.getElementById('atNav');

  /* ---------- 1. 导航滚动状态 ---------- */
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 移动抽屉 ---------- */
  var burger = document.getElementById('atBurger');
  var drawer = document.getElementById('atDrawer');
  var lastFocus = null;

  function openDrawer() {
    if (!drawer || !burger) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.classList.add('is-locked');
    burger.setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('a, button');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!drawer || !burger) return;
    drawer.hidden = true;
    document.body.classList.remove('is-locked');
    burger.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      if (drawer.hidden) openDrawer(); else closeDrawer();
    });
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer || (e.target.closest && e.target.closest('a'))) closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });
  }

  /* ---------- 3. 滚动显现 ---------- */
  var revealTargets = [
    '.at-hero__copy > *',
    '.at-hero__object',
    '.at-head',
    '.at-card',
    '.at-chapter',
    '.at-value',
    '.at-circle'
  ];

  function setupReveal() {
    var els = [];
    revealTargets.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { els.push(el); });
    });
    if (!els.length) return;

    if (reduce.matches || !('IntersectionObserver' in window)) return;

    els.forEach(function (el) { el.classList.add('at-reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // 同组内做细微级联
        var siblings = el.parentElement ? Array.prototype.slice.call(el.parentElement.children) : [];
        var i = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { io.observe(el); });
  }
  setupReveal();

  /* ---------- 4. 玻璃镜头高光（指针跟随） ---------- */
  function setupLens() {
    if (!canHover.matches || reduce.matches) return;
    document.querySelectorAll('[data-lens]').forEach(function (el) {
      var raf = 0;
      var x = 0, y = 0;
      function apply() {
        raf = 0;
        el.style.setProperty('--mx', x + 'px');
        el.style.setProperty('--my', y + 'px');
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        x = Math.round(e.clientX - r.left);
        y = Math.round(e.clientY - r.top);
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      el.addEventListener('pointerleave', function () {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }
  setupLens();

  /* ---------- 5. 会员卡微倾斜 ---------- */
  var member = document.getElementById('atMember');
  if (member && canHover.matches && !reduce.matches) {
    member.addEventListener('pointermove', function (e) {
      var r = member.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      member.style.setProperty('--ry', (px * 8).toFixed(2) + 'deg');
      member.style.setProperty('--rx', (-py * 6).toFixed(2) + 'deg');
    }, { passive: true });
    member.addEventListener('pointerleave', function () {
      member.style.setProperty('--ry', '0deg');
      member.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------- 6. 语言切换后同步 aria 文案 ---------- */
  if (window.I18N) {
    window.I18N.onChange(function () {
      onScroll();
    });
  }
})();
