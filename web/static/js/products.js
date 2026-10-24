/* ============================================================
   SHIRUN — 产品数据层（静态原型版）
   后端就绪后由 GET /api/v1/products 等接口替换，渲染逻辑不变
   ============================================================ */
(function () {
  'use strict';

  var WA = 'https://wa.me/8613388614562?text=';
  function wa(text) { return WA + encodeURIComponent(text); }

  var IMG = 'static/img/';
  function img(n) { return IMG + n; }

  window.SHIRUN_PRODUCTS = [
    {
      sku: 'LG260008', cat: 'caps', catLabel: 'Baseball Caps', name: 'Seamless Solid Colour Cap',
      tagline: 'Seven considered hues for private label and everyday wholesale programs.',
      desc: 'The core of the range — a one-piece seamless baseball cap in seven considered solid colours. Clean lines, no stitched panels, ready for your logo and private-label program.',
      colors: 7, colorsLabel: '7 Colorways', weight: '—', fit: 'One size, elastic', brim: 'Pre-curved',
      material: '—', construction: 'One-piece seamless', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('cap-image-02.jpg'), alt: 'Solid colour seamless cap — camel' },
        { src: img('cap-image-03.jpg'), alt: 'Solid colour seamless cap — orange' },
        { src: img('cap-image-04.jpg'), alt: 'Solid colour seamless cap — red' },
        { src: img('cap-image-05.jpg'), alt: 'Solid colour seamless cap — navy' },
        { src: img('cap-image-06.jpg'), alt: 'Solid colour seamless cap — light grey' },
        { src: img('cap-image-07.jpg'), alt: 'Solid colour seamless cap — olive' },
        { src: img('cap-image-08.jpg'), alt: 'Solid colour seamless cap — black' }
      ],
      waText: "Hello SHIRUN, I'm interested in LG260008 Solid Colour seamless caps."
    },
    {
      sku: 'LG260010', cat: 'caps', catLabel: 'Baseball Caps', name: 'Seamless Camo Cap',
      tagline: 'Six camouflage colorways for outdoor and streetwear edits.',
      desc: 'Six camouflage colorways cut for outdoor, tactical-inspired and fashion programs — the same one-piece seamless construction with a pattern that carries character.',
      colors: 6, colorsLabel: '6 Colorways', weight: '—', fit: 'One size, elastic', brim: 'Pre-curved',
      material: '—', construction: 'One-piece seamless', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('cap-image-09.jpg'), alt: 'Camouflage seamless cap — jungle camo' },
        { src: img('cap-image-10.jpg'), alt: 'Camouflage seamless cap — desert camo' },
        { src: img('cap-image-11.jpg'), alt: 'Camouflage seamless cap — green camo' },
        { src: img('cap-image-12.jpg'), alt: 'Camouflage seamless cap — grey camo' },
        { src: img('cap-image-13.jpg'), alt: 'Camouflage seamless cap — blue camo' },
        { src: img('cap-image-14.jpg'), alt: 'Camouflage seamless cap — sand camo' }
      ],
      waText: "Hello SHIRUN, I'm interested in LG260010 Camo seamless caps."
    },
    {
      sku: 'LG260012', cat: 'caps', catLabel: 'Baseball Caps', name: 'Seamless Hip-Hop Cap',
      tagline: 'Five tonal shades with a clean, modern streetwear silhouette.',
      desc: 'Streetwear-oriented one-piece caps in five tonal shades — grey, army green, black, white and light khaki — with a clean, modern silhouette for custom-logo programs.',
      colors: 5, colorsLabel: '5 Colorways', weight: '—', fit: 'One size, elastic', brim: 'Flat / structured',
      material: '—', construction: 'One-piece seamless', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('cap-image-15.png'), alt: 'Hip-hop seamless cap — grey' },
        { src: img('cap-image-16.png'), alt: 'Hip-hop seamless cap — army green' },
        { src: img('cap-image-17.png'), alt: 'Hip-hop seamless cap — black' },
        { src: img('cap-image-18.png'), alt: 'Hip-hop seamless cap — white' },
        { src: img('cap-image-19.png'), alt: 'Hip-hop seamless cap — light khaki' }
      ],
      waText: "Hello SHIRUN, I'm interested in LG260012 Hip-Hop seamless caps."
    },
    {
      sku: 'VISOR-CRESCENT', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Crescent Visor',
      tagline: 'The signature two-tone crescent — quiet, sculptural, all summer.',
      desc: 'Our signature open-top crescent visor in two-tone combinations. Quiet, sculptural and made to be worn all summer — with UV performance documented by test reports.',
      colors: 5, colorsLabel: 'Two-Tone Options', weight: '95 g', fit: '48–60 cm, adjustable', brim: 'Wide curved',
      material: '75% Nylon + 25% Spandex', construction: 'One-piece, open-top', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('visors/visor-crescent.jpg'), alt: 'Model wearing the pink Seamless Crescent Sun Visor' }
      ],
      waText: "Hello SHIRUN, I'm interested in the Seamless Crescent Sun Visor."
    },
    {
      sku: 'VISOR-KIDS', cat: 'visors', catLabel: 'Sun Visors', name: "Seamless Kids' Sun Visor",
      tagline: 'A featherweight open-top visor sized for young explorers.',
      desc: "A lightweight one-piece sun visor designed for active kids — approximately 60–65 g with an adjustable 40–60 cm fit and eight bright colourways for summer collections.",
      colors: 8, colorsLabel: '8 Colorways', weight: '60–65 g', fit: '40–60 cm, adjustable', brim: 'Curved, 8.5 cm',
      material: '75% Nylon + 25% Spandex', construction: 'One-piece, open-top', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('visors/visor-kids.jpg'), alt: 'Seamless Kids Sun Visor in eight colourways' }
      ],
      waText: "Hello SHIRUN, I'm interested in the Seamless Kids' Sun Visor."
    },
    {
      sku: 'VISOR-UV', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless UV Visor',
      tagline: 'Everyday UV coverage with a wide curved brim.',
      desc: 'A clean, modern UV-protection visor with a wide curved brim and ventilated open top — six core colours plus two-tone combinations suitable for brand programs.',
      colors: 6, colorsLabel: '6 Colors + Two-Tone', weight: '60–65 g', fit: '40–60 cm, adjustable', brim: 'Wide curved, 8.5 cm',
      material: '75% Nylon + 25% Spandex', construction: 'One-piece, open-top', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('visors/visor-uv.jpg'), alt: 'Seamless UV Protection Sun Visor in blue grey' }
      ],
      waText: "Hello SHIRUN, I'm interested in the Seamless UV Protection Sun Visor."
    },
    {
      sku: 'VISOR-STRIPE', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Stripe Visor',
      tagline: 'A four-stripe textured shell with a softly curved silhouette.',
      desc: 'A modern seamless sun visor featuring a clean four-stripe texture — approximately 65–70 g, foldable for travel, in seven versatile colours for lifestyle collections.',
      colors: 7, colorsLabel: '7 Colorways', weight: '65–70 g', fit: '48–60 cm, adjustable', brim: 'Curved',
      material: '75% Nylon + 25% Spandex', construction: 'One-piece, open-top', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('visors/visor-stripe.jpg'), alt: 'Seamless Stripe Sun Visor in cream' }
      ],
      waText: "Hello SHIRUN, I'm interested in the Seamless Stripe Sun Visor."
    },
    {
      sku: 'VISOR-HORN', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Horn Visor',
      tagline: 'Extra-wide coverage engineered for full-face shade.',
      desc: 'The wide-brim horn visor — approximately 28 cm of brim engineered for full-face shade at a light 95 g, in six muted colourways for outdoor and resort programs.',
      colors: 6, colorsLabel: '6 Colorways', weight: '95 g', fit: '48–60 cm, adjustable', brim: 'Extra-wide, ~28 cm',
      material: '75% Nylon + 25% Spandex', construction: 'One-piece, open-top', customization: 'Logo · Colour · Packaging',
      images: [
        { src: img('visors/visor-horn.jpg'), alt: 'Seamless wide-brim horn sun visor in graphite' }
      ],
      waText: "Hello SHIRUN, I'm interested in the Seamless Wide-Brim Horn Sun Visor."
    }
  ];

  window.SHIRUN_WA = wa;
  window.SHIRUN_IMG = img;

  /* ---------- 产品列表页逻辑 ---------- */
  window.SHIRUN_initListing = function () {
    var grid = document.getElementById('productGrid');
    if (!grid) return;

    var params = new URLSearchParams(location.search);
    var state = {
      cat: params.get('cat') || (location.hash.indexOf('#cat-') === 0 ? location.hash.slice(5) : ''),
      q: params.get('q') || '',
      sort: params.get('sort') || 'recommended'
    };
    if (state.cat && !document.querySelector('.fpill[data-cat="' + state.cat + '"]')) state.cat = 'all';
    if (!state.cat) state.cat = 'all';
    if (['recommended', 'colors', 'sku'].indexOf(state.sort) === -1) state.sort = 'recommended';
    var lastList = [];

    // 把筛选状态同步到 URL（可分享、刷新保留、后退可用）
    function syncUrl() {
      try {
        var sp = new URLSearchParams();
        if (state.cat !== 'all') sp.set('cat', state.cat);
        if (state.q) sp.set('q', state.q);
        if (state.sort !== 'recommended') sp.set('sort', state.sort);
        var qs = sp.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      } catch (e) { /* file:// 等环境限制时静默跳过 */ }
    }
    var searchEl = document.getElementById('searchInput');
    var sortEl = document.getElementById('sortSelect');
    var countEl = document.getElementById('resultCount');
    var pills = document.querySelectorAll('.fpill');

    function apply() {
      var list = window.SHIRUN_PRODUCTS.slice();
      if (state.cat !== 'all') list = list.filter(function (p) { return p.cat === state.cat; });
      if (state.q) {
        var q = state.q.toLowerCase();
        list = list.filter(function (p) {
          return (p.name + ' ' + p.sku + ' ' + p.tagline).toLowerCase().indexOf(q) !== -1;
        });
      }
      if (state.sort === 'sku') list.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });
      else if (state.sort === 'colors') list.sort(function (a, b) { return b.colors - a.colors; });
      lastList = list;
      syncUrl();

      countEl.textContent = list.length + (list.length === 1 ? ' product' : ' products');
      if (!list.length) {
        grid.innerHTML = '<div class="empty glass"><h3>No products found</h3><p>Try a different keyword or clear the filters.</p><button class="btn btn--glass" id="clearFilters" type="button">Clear Filters</button></div>';
        var c = document.getElementById('clearFilters');
        if (c) c.addEventListener('click', function () {
          state.q = ''; searchEl.value = ''; state.cat = 'all';
          pills.forEach(function (p) { p.classList.toggle('is-active', p.dataset.cat === 'all'); });
          apply();
        });
        return;
      }
      grid.innerHTML = list.map(function (p, i) {
        var d = i < 3 ? ' reveal--d' + i : '';
        return '<article class="pcard glass reveal ' + d + '">' +
          '<a class="pcard__media pcard__media--single" href="product.html?sku=' + encodeURIComponent(p.sku) + '" aria-label="View ' + p.name + '">' +
          '<img src="' + p.images[0].src + '" alt="' + p.images[0].alt + '" loading="lazy" width="640" height="480"/></a>' +
          '<div class="pcard__body">' +
          '<p class="pcard__sku">' + p.sku + ' &middot; ' + p.catLabel + '</p>' +
          '<h3><a href="product.html?sku=' + encodeURIComponent(p.sku) + '">' + p.name + '</a></h3>' +
          '<p>' + p.tagline + '</p>' +
          '<div class="pcard__meta"><span class="pill">' + p.colorsLabel + '</span><span class="pill">OEM / ODM</span><span class="pill">Custom Logo</span></div>' +
          '<a class="pcard__cta" href="product.html?sku=' + encodeURIComponent(p.sku) + '">View product <span aria-hidden="true">&rarr;</span></a>' +
          '</div></article>';
      }).join('');
      if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
        }, { threshold: 0.08, rootMargin: '0px 0px 12% 0px' });
        grid.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
      } else {
        grid.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
      }
    }

    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        pills.forEach(function (x) { x.classList.remove('is-active'); });
        p.classList.add('is-active');
        state.cat = p.dataset.cat;
        apply();
      });
    });
    var t;
    searchEl.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = searchEl.value.trim(); apply(); }, 220);
    });
    // 回车：唯一命中时直达该产品
    searchEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (lastList.length === 1) {
        location.href = 'product.html?sku=' + encodeURIComponent(lastList[0].sku);
      } else if (lastList.length > 1) {
        var first = grid.querySelector('.pcard .pcard__cta');
        if (first) first.focus();
      }
    });
    sortEl.addEventListener('change', function () { state.sort = sortEl.value; apply(); });

    // 支持 ?cat=visors 激活对应 pill；?q= / ?sort= 反映到控件
    pills.forEach(function (p) { if (p.dataset.cat === state.cat) p.classList.add('is-active'); });
    searchEl.value = state.q;
    sortEl.value = state.sort;
    apply();
  };

  /* ---------- 产品详情页逻辑 ---------- */
  window.SHIRUN_initDetail = function () {
    var root = document.getElementById('productDetail');
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var sku = params.get('sku') || (location.hash && location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '');
    var p = window.SHIRUN_PRODUCTS.find(function (x) { return x.sku === sku; });
    var notFound = document.getElementById('pdNotFound');

    if (!p) {
      root.hidden = true;
      notFound.hidden = false;
      document.title = 'Product Not Found — SHIRUN';
      return;
    }

    document.title = p.name + ' — ' + p.sku + ' | SHIRUN';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', p.tagline);

    var el = function (id) { return document.getElementById(id); };
    var pdCat = el('pdCat');
    if (pdCat) pdCat.textContent = p.catLabel + ' · ' + p.sku;
    var pdName = el('pdName');
    if (pdName) pdName.textContent = p.name;
    var pdDesc = el('pdDesc');
    if (pdDesc) pdDesc.textContent = p.desc;
    var waInline = el('pdWa');
    if (waInline) waInline.href = window.SHIRUN_WA(p.waText);
    var waTop = el('pdWaTop');
    if (waTop) waTop.href = window.SHIRUN_WA(p.waText);

    // 图库
    var main = el('pdMain');
    var thumbs = el('pdThumbs');
    if (!main || !thumbs) return;
    main.src = p.images[0].src;
    main.alt = p.images[0].alt;
    main.dataset.index = '0';
    main.dataset.gallery = JSON.stringify(p.images);
    thumbs.innerHTML = p.images.map(function (im, i) {
      return '<button class="pdthumb' + (i === 0 ? ' is-active' : '') + '" type="button" data-i="' + i + '" aria-label="Show image ' + (i + 1) + ' of ' + p.images.length + ': ' + im.alt + '">' +
        '<img src="' + im.src + '" alt="" loading="lazy" width="120" height="120"/></button>';
    }).join('');
    thumbs.addEventListener('click', function (e) {
      var b = e.target.closest('.pdthumb');
      if (!b) return;
      thumbs.querySelectorAll('.pdthumb').forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      var im = p.images[+b.dataset.i];
      main.src = im.src; main.alt = im.alt; main.dataset.index = b.dataset.i;
    });

    // 参数表（字段可能为空 — 需求允许部分参数留空）
    var rows = [
      ['Product SKU', p.sku],
      ['Material', p.material],
      ['Construction', p.construction],
      ['Weight', p.weight],
      ['Head Circumference', p.fit],
      ['Brim', p.brim],
      ['Colourways', p.colorsLabel],
      ['Customization', p.customization],
      ['MOQ & Lead Time', 'Confirmed per order']
    ].filter(function (r) { return r[1] && r[1] !== '—'; });
    var specTable = el('pdSpecs');
    if (specTable) specTable.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
    }).join('');

    // 相关产品（同分类优先，最多 3 个）
    var related = window.SHIRUN_PRODUCTS.filter(function (x) { return x.sku !== p.sku && x.cat === p.cat; })
      .concat(window.SHIRUN_PRODUCTS.filter(function (x) { return x.sku !== p.sku && x.cat !== p.cat; }))
      .slice(0, 3);
    var relBox = el('pdRelated');
    if (relBox) relBox.innerHTML = related.map(function (r) {
      return '<a class="relcard glass" href="product.html?sku=' + encodeURIComponent(r.sku) + '">' +
        '<img src="' + r.images[0].src + '" alt="' + r.images[0].alt + '" loading="lazy" width="200" height="150"/>' +
        '<span class="relcard__sku">' + r.sku + '</span><b>' + r.name + '</b></a>';
    }).join('');
  };

  /* ---------- 自动初始化（按页面元素存在性） ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    window.SHIRUN_initListing();
    window.SHIRUN_initDetail();
  });
})();
