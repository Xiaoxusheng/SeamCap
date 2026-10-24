/* ============================================================
   SHIRUN LUXE — main.js
   渐进增强：导航状态 / 移动抽屉 / 滚动显现 / 视频点击播放
   全部为纯原生 JS，无依赖；reduce-motion 下自动降级
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- 2. 移动端抽屉菜单 ---------- */
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('mobileMenu');
  if (toggle && drawer) {
    var panel = drawer.querySelector('.drawer__panel');
    function closeDrawer() {
      drawer.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      if (open) { closeDrawer(); } else {
        drawer.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
      }
    });
    // 点击链接或遮罩关闭
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer || (panel && panel.contains(e.target) && e.target.tagName === 'A')) {
        closeDrawer();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) { closeDrawer(); toggle.focus(); }
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
      if (!data.name) { fieldError('name', 'Please enter your name.'); bad = true; }
      else if (data.name.length > 100) { fieldError('name', 'Name is too long (max 100).'); bad = true; }
      if (!data.email) { fieldError('email', 'Please enter your email.'); bad = true; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { fieldError('email', 'Please enter a valid email address.'); bad = true; }
      else if (data.email.length > 200) { fieldError('email', 'Email is too long (max 200).'); bad = true; }
      if (!data.message) { fieldError('message', 'Please tell us about your requirement.'); bad = true; }
      else if (data.message.length < 10) { fieldError('message', 'Message should be at least 10 characters.'); bad = true; }
      else if (data.message.length > 5000) { fieldError('message', 'Message is too long (max 5000).'); bad = true; }
      if (!form.consent.checked) { fieldError('consent', 'Please confirm the privacy notice.'); bad = true; }
      if (bad) return;

      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';
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
          var msg = (body && body.error && body.error.message) || 'Submission failed. Please try again.';
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
          statusEl.textContent = 'Our online enquiry service is not deployed yet. Please reach us directly on WhatsApp +86 133 8861 4562 — your message is kept below so you can copy it.';
        } else {
          statusEl.hidden = false;
          statusEl.textContent = err.message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      });
    });
  }
})();
