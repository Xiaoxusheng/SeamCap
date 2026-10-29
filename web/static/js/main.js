/* ============================================================
   SHIRUN LUXE — main.js
   渐进增强：导航状态 / 移动抽屉 / 滚动显现 / 视频点击播放
   全部为纯原生 JS，无依赖；reduce-motion 下自动降级
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function t(key, vars) { return window.I18N ? window.I18N.t(key, vars) : key; }

  /* ---------- 0. 图片缩放 URL（低带宽优化） ----------
     /uploads/ 下的媒体按展示宽度请求服务端缩放版本（internal/imgsrv ?w= 按需
     生成 + 磁盘缓存）；静态图与外链不受影响。灯箱/原图场景直接用原始 URL。 */
  function thumbURL(url, w) {
    var s = String(url == null ? '' : url);
    if (s.indexOf('/uploads/') !== 0 || s.indexOf('?') !== -1) return s;
    return s + '?w=' + w;
  }
  window.SHIRUN_thumbURL = thumbURL;

  /* ---------- 0.5 首页加载动画（仅首页存在 #bootLoader 时启用） ----------
     load 后淡出；至少展示 800ms 避免闪一下，最多 3.6s 防止图片/字体
     卡住时遮罩久留；reduce-motion 下直接跳过。 */
  (function bootLoader() {
    var el = document.getElementById('bootLoader');
    if (!el) return;
    var MIN_SHOW = 800, MAX_WAIT = 3600;
    var start = (window.performance && performance.now) ? performance.now() : Date.now();
    var done = false;

    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function hide() {
      if (done) return;
      done = true;
      el.classList.add('is-done');
      document.body.classList.remove('is-booting');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 700);
    }
    function finish() {
      setTimeout(hide, Math.max(0, MIN_SHOW - (now() - start)));
    }

    if (reduceMotion) { hide(); return; }
    document.body.classList.add('is-booting');
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    setTimeout(hide, MAX_WAIT);
  })();

  /* ---------- 1. 导航滚动状态 ---------- */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 24) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 移动端抽屉菜单（焦点移入 / Tab 循环 / 关闭归还） ---------- */
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('mobileMenu');
  if (toggle && drawer) {
    var panel = drawer.querySelector('.drawer__panel');
    var lastFocus = null;

    function drawerFocusables() {
      if (!panel) return [];
      return Array.prototype.filter.call(
        panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.getClientRects().length > 0; }
      );
    }

    function closeDrawer() {
      if (drawer.hidden) return;
      drawer.hidden = true;
      document.body.classList.remove('drawer-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', t('common.openMenu'));
      (lastFocus && lastFocus.focus ? lastFocus : toggle).focus();
      lastFocus = null;
    }

    function openDrawer() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      document.body.classList.add('drawer-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', t('common.closeMenu'));
      var items = drawerFocusables();
      if (items.length) { items[0].focus(); }
      else if (panel) { panel.focus(); }
    }

    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') { closeDrawer(); }
      else { openDrawer(); }
    });
    // 点击链接或遮罩关闭
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer || (panel && panel.contains(e.target) && e.target.tagName === 'A')) {
        closeDrawer();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (drawer.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      var items = drawerFocusables();
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      var inside = panel.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus(); }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ---------- 3. 滚动显现（IntersectionObserver + 级联延迟） ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 12% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 4. 视频点击播放（封面 + 按需加载） ---------- */
  document.querySelectorAll('.vcard__stage').forEach(function (stage) {
    stage.addEventListener('click', function () {
      if (stage.classList.contains('is-playing')) { return; }
      var src = stage.getAttribute('data-video');
      var video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.src = src;
      stage.appendChild(video);
      stage.classList.add('is-playing');
      var p = video.play();
      if (p && p.catch) { p.catch(function () { /* 自动播放被拒：用户可手动点击控件 */ }); }
    });
  });

  /* ---------- 5. 灯箱（产品详情大图预览） ---------- */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('.lightbox__img');
    var lbClose = lightbox.querySelector('.lightbox__close');
    var lbPrev = lightbox.querySelector('.lightbox__nav--prev');
    var lbNext = lightbox.querySelector('.lightbox__nav--next');
    var lbData = [], lbIndex = 0, lbLastFocus = null;

    function lbRender() {
      var im = lbData[lbIndex];
      if (im) { lbImg.src = im.src; lbImg.alt = im.alt; }
      lbImg.setAttribute('aria-describedby', 'lbCount');
      lightbox.querySelector('#lbCount').textContent = (lbIndex + 1) + ' / ' + lbData.length;
    }
    function lbOpen(i) {
      lbLastFocus = document.activeElement;
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      lbRender();
      lbClose.focus();
    }
    function lbHide() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      if (lbLastFocus) lbLastFocus.focus();
    }
    function lbStep(d) { lbIndex = (lbIndex + d + lbData.length) % lbData.length; lbRender(); }

    document.addEventListener('click', function (e) {
      var main = document.getElementById('pdMain');
      if (main && e.target === main && main.dataset.gallery) {
        lbData = JSON.parse(main.dataset.gallery);
        lbIndex = +(main.dataset.index || 0);
        lbOpen(lbIndex);
      }
    });
    lbClose.addEventListener('click', lbHide);
    lbPrev.addEventListener('click', function () { lbStep(-1); });
    lbNext.addEventListener('click', function () { lbStep(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lbHide(); });
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') lbHide();
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
    });
  }

  /* ---------- 6. 询价表单（真实提交到 Go 后端 /api/v1/inquiries） ---------- */
  var form = document.getElementById('inquiryForm');
  if (form) {
    var statusEl = document.getElementById('formStatus');
    var submitBtn = form.querySelector('button[type="submit"]');

    function fieldError(name, msg) {
      var input = form.querySelector('[name="' + name + '"]');
      var err = form.querySelector('[data-err="' + name + '"]');
      if (input) input.setAttribute('aria-invalid', 'true');
      if (err) { err.textContent = msg; err.hidden = false; }
    }
    function clearErrors() {
      form.querySelectorAll('[data-err]').forEach(function (el) { el.hidden = true; el.textContent = ''; });
      form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
      statusEl.hidden = true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      if (form.website.value) { return; }  // honeypot：静默丢弃

      var data = {
        name: form.name.value.trim(),
        company: form.company.value.trim(),
        email: form.email.value.trim(),
        whatsapp_phone: form.phone.value.trim(),
        product_name_snapshot: form.product.value,
        estimated_qty: form.qty.value.trim(),
        customization: form.customization.value.trim(),
        message: form.message.value.trim(),
        source_page: location.pathname
      };

      var bad = false;
      if (!data.name) { fieldError('name', t('form.nameRequired')); bad = true; }
      else if (data.name.length > 100) { fieldError('name', t('form.nameLong')); bad = true; }
      if (!data.email) { fieldError('email', t('form.emailRequired')); bad = true; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { fieldError('email', t('form.emailInvalid')); bad = true; }
      else if (data.email.length > 200) { fieldError('email', t('form.emailLong')); bad = true; }
      if (!data.message) { fieldError('message', t('form.messageRequired')); bad = true; }
      else if (data.message.length < 10) { fieldError('message', t('form.messageShort')); bad = true; }
      else if (data.message.length > 5000) { fieldError('message', t('form.messageLong')); bad = true; }
      if (!form.consent.checked) { fieldError('consent', t('form.consentRequired')); bad = true; }
      if (bad) return;

      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = t('form.sending');
      statusEl.hidden = true;

      fetch('/api/v1/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (r.status === 201 || r.ok) return r.json().catch(function () { return {}; });
        if (r.status === 404 || r.status >= 500) {          // 后端未部署或网关错误
          var off = new Error('OFFLINE');
          off.offline = true;
          throw off;
        }
        return r.json().catch(function () { return {}; }).then(function (body) {
          var msg = (body && body.error && body.error.message) || t('form.submitFailed');
          if (body && body.error && body.error.fields) {
            Object.keys(body.error.fields).forEach(function (k) { fieldError(k, body.error.fields[k]); });
          }
          throw new Error(msg);
        });
      }).then(function () {
        form.hidden = true;
        var ok = document.getElementById('formSuccess');
        if (ok) ok.hidden = false;
        ok && ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (err) {
        if (err.offline || err instanceof TypeError || /fetch/i.test(err.message)) {
          statusEl.hidden = false;
          statusEl.textContent = t('form.offline');
        } else {
          statusEl.hidden = false;
          statusEl.textContent = err.message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      });
    });
  }
  /* ---------- 7. 自定义下拉：暗色弹层替代原生 select（保留原 select 供表单/JS 使用） ---------- */
  function initLuxSelect(select) {
    if (select.dataset.luxsel || select.multiple) return;
    select.dataset.luxsel = '1';

    var isField = !!select.closest('.field');
    var wrap = document.createElement('span');
    wrap.className = 'luxsel-wrap' + (isField ? ' luxsel-wrap--full' : '');
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('lux-hidden-select');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    var opts = Array.prototype.slice.call(select.options);
    var listId = 'luxsel-' + Math.random().toString(36).slice(2, 8);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'luxsel' + (isField ? ' luxsel--field' : '');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', listId);
    var label = document.createElement('span');
    label.className = 'luxsel__label';
    var chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chev.setAttribute('class', 'luxsel__chev');
    chev.setAttribute('viewBox', '0 0 24 24');
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    btn.appendChild(label);
    btn.appendChild(chev);

    var pop = document.createElement('div');
    pop.className = 'luxsel__pop';
    pop.id = listId;
    pop.hidden = true;
    pop.setAttribute('role', 'listbox');

    var optEls = opts.map(function (o, i) {
      var d = document.createElement('div');
      d.className = 'luxsel__opt';
      d.id = listId + '-o' + i;
      d.setAttribute('role', 'option');
      d.setAttribute('aria-selected', o.selected ? 'true' : 'false');
      d.dataset.value = o.value;
      d.textContent = o.textContent;
      pop.appendChild(d);
      return d;
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);

    function syncUI() {
      var idx = select.selectedIndex;
      label.textContent = idx >= 0 ? select.options[idx].textContent : '';
      optEls.forEach(function (el, j) { el.setAttribute('aria-selected', j === idx ? 'true' : 'false'); });
    }
    select.__luxsync = syncUI;
    // 语言切换后：option 文本由 data-i18n 更新，这里同步弹层与显示
    select.__luxRefresh = function () {
      opts.forEach(function (o, i) { if (optEls[i]) optEls[i].textContent = o.textContent; });
      syncUI();
    };
    syncUI();

    var open = false, active = -1;
    function renderActive() {
      optEls.forEach(function (el, i) { el.classList.toggle('is-active', i === active); });
      if (active >= 0) optEls[active].scrollIntoView({ block: 'nearest' });
    }
    function setOpen(v) {
      open = v;
      pop.hidden = !v;
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) { active = select.selectedIndex; renderActive(); }
    }
    function commit(i) {
      if (i < 0 || i >= optEls.length) return;
      select.value = optEls[i].dataset.value;
      syncUI();
      setOpen(false);
      btn.focus();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    btn.addEventListener('click', function () { setOpen(!open); });
    optEls.forEach(function (el, i) {
      el.addEventListener('click', function () { commit(i); });
    });
    btn.addEventListener('keydown', function (e) {
      if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); return; }
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, optEls.length - 1); renderActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderActive(); }
      else if (e.key === 'Home') { e.preventDefault(); active = 0; renderActive(); }
      else if (e.key === 'End') { e.preventDefault(); active = optEls.length - 1; renderActive(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(active); }
      else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (e.key === 'Tab') { setOpen(false); }
    });
    document.addEventListener('click', function (e) {
      if (open && !wrap.contains(e.target)) setOpen(false);
    });
  }
  document.querySelectorAll('select').forEach(initLuxSelect);

  /* ---------- 8. 语言切换联动：刷新自定义下拉的显示文本 ---------- */
  if (window.I18N) {
    window.I18N.onChange(function () {
      document.querySelectorAll('select').forEach(function (s) {
        if (typeof s.__luxRefresh === 'function') s.__luxRefresh();
      });
    });
  }

  /* ---------- 10. 白天 / 夜间主题切换 ---------- */
  var themeBtns = document.querySelectorAll('[data-theme-toggle]');
  function syncThemeBtns() {
    var isLight = window.ShirunTheme && window.ShirunTheme.current() === 'light';
    var label = isLight ? t('common.themeToDark') : t('common.themeToLight');
    themeBtns.forEach(function (btn) {
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }
  themeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!window.ShirunTheme) return;
      window.ShirunTheme.toggle();
      syncThemeBtns();
    });
  });
  if (themeBtns.length) {
    syncThemeBtns();
    document.addEventListener('themechange', syncThemeBtns);
    if (window.I18N) window.I18N.onChange(syncThemeBtns);
  }

  /* ---------- 11. 玻璃镜头高光（指针跟随，仅桌面 hover 设备） ----------
     用事件委托而不是逐个绑定：CMS 动态渲染的卡片（#cmsFeatured 等）也能生效。 */
  (function initLens() {
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover || reduceMotion) return;
    var SEL = '.pcard, .vhero, .vrow, .value, .circle, .form-panel, .pack-item, .relcard';
    var current = null, raf = 0, mx = 0, my = 0;

    function clear(el) {
      if (!el) return;
      el.style.removeProperty('--lx');
      el.style.removeProperty('--ly');
    }
    function paint() {
      raf = 0;
      if (!current) return;
      var r = current.getBoundingClientRect();
      current.style.setProperty('--lx', Math.round(mx - r.left) + 'px');
      current.style.setProperty('--ly', Math.round(my - r.top) + 'px');
    }

    document.addEventListener('pointermove', function (e) {
      var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (el !== current) {
        clear(current);
        current = el;
        if (el) el.classList.add('lens');
      }
      if (!current) return;
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });

    document.addEventListener('pointerleave', function () { clear(current); }, true);
  })();

  /* ---------- 9. WhatsApp 链接：微信内置浏览器兜底 ----------
     微信 WebView 不允许 target="_blank" 新开页面，外链点击无反应。
     这里全局拦截 wa.me / whatsapp.com 链接：改为当前页跳转尝试拉起
     WhatsApp，并先复制号码 + 弹提示，未装 WhatsApp 时用户仍可手动联系。 */
  var IS_WECHAT = /MicroMessenger/i.test(navigator.userAgent);
  function waExtractNumber(href) {
    var m = String(href || '').match(/wa\.me\/(\d+)/);
    return m ? '+' + m[1] : '';
  }
  function waToast(msg) {
    var el = document.createElement('div');
    el.className = 'wa-toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    // 强制一帧后再显示，保证过渡动画生效
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 400);
    }, 3200);
  }
  function waCopy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
        return true;
      }
    } catch (err) { /* 忽略，走降级 */ }
    // 降级：execCommand 复制（旧版微信 WebView）
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (err) { return false; }
  }
  if (IS_WECHAT) {
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest
        ? e.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]')
        : null;
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (href.indexOf('http') !== 0) return;
      e.preventDefault();
      var num = waExtractNumber(href);
      var copied = num ? waCopy(num) : false;
      var msg = (copied && num)
        ? 'Opening WhatsApp… Number ' + num + ' copied. If nothing happens, paste it manually.'
        : 'Opening WhatsApp… If nothing happens, open this page in your browser.';
      waToast(msg);
      // 稍作延迟让提示先呈现，再当前页跳转拉起 WhatsApp
      setTimeout(function () { window.location.href = href; }, 800);
    }, true);
  }
})();
