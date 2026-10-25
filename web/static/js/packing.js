/* ============================================================
   SHIRUN — Packing & Dispatch 图库
   数据源：GET /api/v1/packing（后台「打包发货」素材库）
   渐进增强：接口不可达时给出提示，不影响页面其余内容。
   依赖：window.I18N（可选）、window.SHIRUN_thumbURL（可选）
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/v1';
  var grid = document.getElementById('packGrid');
  if (!grid) return;

  var pillsEl = document.getElementById('packPills');
  var countEl = document.getElementById('packCount');
  var statusEl = document.getElementById('packStatus');

  var CATS = [
    { key: 'packing', label: 'packing.catPacking', fallback: 'Packing' },
    { key: 'loading', label: 'packing.catLoading', fallback: 'Loading' },
    { key: 'warehouse', label: 'packing.catWarehouse', fallback: 'Warehouse' }
  ];

  var state = { items: [], filter: 'all', images: [], index: 0, ready: false };

  function t(key, fallback, vars) {
    if (window.I18N && window.I18N.t) {
      var v = window.I18N.t(key, vars);
      if (v && v !== key) return v;
    }
    if (fallback == null) return key;
    // 简单变量替换：{n}
    var out = String(fallback);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function thumb(url, w) {
    return window.SHIRUN_thumbURL ? window.SHIRUN_thumbURL(url, w) : url;
  }

  function isVideo(it) {
    return !!(it.media && /^video\//.test(it.media.mime_type || ''));
  }

  function catLabel(key) {
    var c = CATS.filter(function (x) { return x.key === key; })[0];
    return c ? t(c.label, c.fallback) : t('packing.catPacking', 'Packing');
  }

  function visible() {
    if (state.filter === 'all') return state.items;
    return state.items.filter(function (it) { return it.category === state.filter; });
  }

  /* ---------- 分类筛选 ---------- */

  function renderPills() {
    if (!pillsEl) return;
    var counts = {};
    state.items.forEach(function (it) { counts[it.category] = (counts[it.category] || 0) + 1; });
    var total = state.items.length;
    var present = CATS.filter(function (c) { return counts[c.key]; });

    // 只有一个分类时不显示筛选条（避免"全部/唯一分类"两个等价按钮）
    if (present.length <= 1) {
      pillsEl.hidden = true;
      pillsEl.innerHTML = '';
      return;
    }
    pillsEl.hidden = false;

    var html = '<button class="fpill' + (state.filter === 'all' ? ' is-active' : '') +
      '" type="button" data-cat="all">' + esc(t('packing.filterAll', 'All')) +
      ' <span>' + total + '</span></button>';
    present.forEach(function (c) {
      html += '<button class="fpill' + (state.filter === c.key ? ' is-active' : '') +
        '" type="button" data-cat="' + esc(c.key) + '">' + esc(catLabel(c.key)) +
        ' <span>' + counts[c.key] + '</span></button>';
    });
    pillsEl.innerHTML = html;

    pillsEl.querySelectorAll('.fpill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-cat') || 'all';
        renderPills();
        renderGrid();
      });
    });
  }

  /* ---------- 图库 ---------- */

  function renderGrid() {
    var items = visible();
    state.images = items.filter(function (it) { return !isVideo(it); });

    if (countEl) {
      countEl.textContent = t('packing.count', '{n} records', { n: items.length });
    }

    grid.innerHTML = items.map(function (it) {
      var m = it.media || {};
      var cat = catLabel(it.category);
      var title = it.title || '';
      var cap = it.caption || '';
      var alt = m.alt_text || title || t('packing.altFallback', 'Packing and dispatch photo');
      var meta =
        '<span class="pack-item__cat">' + esc(cat) + '</span>' +
        (title ? '<b class="pack-item__title">' + esc(title) + '</b>' : '') +
        (cap ? '<span class="pack-item__cap">' + esc(cap) + '</span>' : '');

      if (isVideo(it)) {
        return '<figure class="pack-item pack-item--video" data-cat="' + esc(it.category) + '">' +
          '<button class="pack-item__stage" type="button" data-video="' + esc(m.url) + '"' +
          ' aria-label="' + esc(t('packing.playClip', 'Play clip') + ': ' + alt) + '">' +
          '<video class="pack-item__media" src="' + esc(m.url) + '#t=0.6" preload="metadata" muted playsinline' +
          (m.width && m.height ? ' width="' + m.width + '" height="' + m.height + '"' : '') + '></video>' +
          '<span class="pack-item__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></span>' +
          '</button>' +
          '<figcaption class="pack-item__meta">' + meta + '</figcaption>' +
          '</figure>';
      }

      var idx = state.images.indexOf(it);
      return '<figure class="pack-item" data-cat="' + esc(it.category) + '">' +
        '<button class="pack-item__stage" type="button" data-index="' + idx + '"' +
        ' aria-label="' + esc(t('packing.openPhoto', 'Open photo') + ': ' + alt) + '">' +
        '<img class="pack-item__media" src="' + esc(thumb(m.url, 640)) + '"' +
        ' alt="' + esc(alt) + '" loading="lazy" decoding="async"' +
        (m.width && m.height ? ' width="' + m.width + '" height="' + m.height + '"' : '') + '/>' +
        '</button>' +
        '<figcaption class="pack-item__meta">' + meta + '</figcaption>' +
        '</figure>';
    }).join('');

    if (items.length === 0) {
      grid.innerHTML = '';
      showStatus(t('packing.empty', 'No records in this category yet.'));
    } else if (statusEl) {
      statusEl.hidden = true;
    }

    bindGrid();
  }

  function bindGrid() {
    grid.querySelectorAll('.pack-item__stage[data-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLightbox(Number(btn.getAttribute('data-index')) || 0);
      });
    });
    grid.querySelectorAll('.pack-item__stage[data-video]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-playing')) return;
        var src = btn.getAttribute('data-video');
        var video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.className = 'pack-item__media';
        btn.innerHTML = '';
        btn.appendChild(video);
        btn.classList.add('is-playing');
        btn.removeAttribute('aria-label');
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      });
    });
  }

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = msg;
  }

  /* ---------- 灯箱 ---------- */

  var lb = null;

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'pack-lb';
    lb.id = 'packLightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="pack-lb__close" type="button" aria-label="' + esc(t('packing.lbClose', 'Close')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg></button>' +
      '<button class="pack-lb__nav pack-lb__nav--prev" type="button" aria-label="' + esc(t('packing.lbPrev', 'Previous photo')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg></button>' +
      '<figure class="pack-lb__figure"><img class="pack-lb__img" alt=""/><figcaption class="pack-lb__cap"></figcaption></figure>' +
      '<button class="pack-lb__nav pack-lb__nav--next" type="button" aria-label="' + esc(t('packing.lbNext', 'Next photo')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4L13.2 12z"/></svg></button>' +
      '<p class="pack-lb__count" aria-live="polite"></p>';
    document.body.appendChild(lb);

    lb.querySelector('.pack-lb__close').addEventListener('click', closeLightbox);
    lb.querySelector('.pack-lb__nav--prev').addEventListener('click', function () { step(-1); });
    lb.querySelector('.pack-lb__nav--next').addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  }

  var lbLastFocus = null;

  function paintLightbox() {
    var it = state.images[state.index];
    if (!it) return;
    var m = it.media || {};
    var img = lb.querySelector('.pack-lb__img');
    img.src = m.url;
    img.alt = m.alt_text || it.title || t('packing.altFallback', 'Packing and dispatch photo');
    lb.querySelector('.pack-lb__cap').textContent =
      [it.title, it.caption].filter(Boolean).join(' — ');
    lb.querySelector('.pack-lb__count').textContent = (state.index + 1) + ' / ' + state.images.length;
    var multi = state.images.length > 1;
    lb.querySelectorAll('.pack-lb__nav').forEach(function (b) { b.hidden = !multi; });
  }

  function openLightbox(i) {
    if (!state.images.length) return;
    if (!lb) buildLightbox();
    lbLastFocus = document.activeElement;
    state.index = Math.max(0, Math.min(i, state.images.length - 1));
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    paintLightbox();
    var close = lb.querySelector('.pack-lb__close');
    if (close) close.focus();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
  }

  function step(d) {
    if (!state.images.length) return;
    state.index = (state.index + d + state.images.length) % state.images.length;
    paintLightbox();
  }

  document.addEventListener('keydown', function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  /* ---------- 加载 ---------- */

  function skeletons(n) {
    var out = '';
    for (var i = 0; i < n; i += 1) {
      out += '<div class="pack-item pack-item--skeleton" aria-hidden="true"><span class="sc-skel"></span></div>';
    }
    return out;
  }

  grid.innerHTML = skeletons(6);

  fetch(API + '/packing', { headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (body) {
      var items = (body && body.data) || [];
      state.items = Array.isArray(items) ? items : [];
      state.ready = true;
      renderPills();
      renderGrid();
    })
    .catch(function () {
      grid.innerHTML = '';
      showStatus(t('packing.loadError', 'The gallery is taking longer to load — refresh the page, or message us on WhatsApp for packing photos.'));
    });

  if (window.I18N && window.I18N.onChange) {
    window.I18N.onChange(function () {
      if (!state.ready) return;
      renderPills();
      renderGrid();
      if (lb && !lb.hidden) paintLightbox();
    });
  }
})();
