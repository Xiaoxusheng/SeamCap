/* ============================================================
   SHIRUN — 产品数据层
   优先从后台 API 加载（分类 pills / 产品卡 / 详情均由后台驱动）；
   API 不可达（file:// 打开或后台未启动）时回退到内置静态数据。
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/v1';
  var WA = 'https://wa.me/8613388614562?text=';
  function wa(text) { return WA + encodeURIComponent(text); }

  var IMG = 'static/img/';
  function img(n) { return IMG + n; }

  /* ---------- 静态兜底数据（后台不可用时使用；colors 为色数） ---------- */
  window.SHIRUN_PRODUCTS = [
    {
      sku: 'LG260008', slug: 'lg260008-solid-color-seamless-cap', cat: 'caps', catLabel: 'Solid Color', name: 'Seamless Solid Colour Cap',
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
      sku: 'LG260010', slug: 'lg260010-camouflage-seamless-cap', cat: 'caps', catLabel: 'Camouflage', name: 'Seamless Camo Cap',
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
      sku: 'LG260012', slug: 'lg260012-hip-hop-seamless-cap', cat: 'caps', catLabel: 'Hip-Hop', name: 'Seamless Hip-Hop Cap',
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
      sku: 'VISOR-CRESCENT', slug: 'seamless-crescent-sun-visor', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Crescent Visor',
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
      sku: 'VISOR-KIDS', slug: 'seamless-kids-sun-visor', cat: 'visors', catLabel: 'Sun Visors', name: "Seamless Kids' Sun Visor",
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
      sku: 'VISOR-UV', slug: 'seamless-uv-protection-sun-visor', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless UV Visor',
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
      sku: 'VISOR-STRIPE', slug: 'seamless-stripe-sun-visor', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Stripe Visor',
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
      sku: 'VISOR-HORN', slug: 'seamless-wide-brim-horn-sun-visor', cat: 'visors', catLabel: 'Sun Visors', name: 'Seamless Horn Visor',
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
  window.SHIRUN_CATEGORIES = [
    { slug: 'caps', name: 'Baseball Caps', name_en: 'Baseball Caps' },
    { slug: 'visors', name: 'Sun Visors', name_en: 'Sun Visors' }
  ];

  /* ---------- 后台 API 加载：分类 pills 与产品由后台驱动 ---------- */

  function colorwayCount(colors) {
    if (typeof colors === 'number') return colors;
    if (!colors) return 0;
    return colors.split(',').filter(function (s) { return s.trim(); }).length;
  }

  function colorwayLabel(p) {
    var n = colorwayCount(p.colors);
    return n > 1 ? n + ' Colorways' : 'Custom Colourways';
  }

  // 把后台产品归一化为页面渲染结构
  function normalizeProduct(p, catById) {
    var cat = p.category || catById[p.category_id] || {};
    var imgs = (p.images && p.images.length ? p.images : (p.main_image ? [p.main_image] : []))
      .map(function (m) { return { src: m.url, alt: m.alt_text || m.original_name || p.name }; });
    var waSku = p.sku || p.slug;
    return {
      sku: waSku,
      slug: p.slug,
      cat: cat.slug || '',
      catLabel: cat.name_en || cat.name || '',   // 英文站优先英文分类名
      name: p.name,
      tagline: p.short_desc || '',
      desc: p.detail_desc || '',
      colors: colorwayCount(p.colors),
      colorsLabel: colorwayLabel(p),
      fit: p.sizes || '—',
      brim: p.cap_shape || '—',
      material: p.material || '—',
      construction: p.cap_shape || 'One-piece seamless',
      customization: p.customization || 'Logo · Colour · Packaging',
      isFeatured: !!p.is_featured,
      images: imgs,
      waText: 'Hello SHIRUN, I\'m interested in ' + (waSku ? waSku + ' ' : '') + p.name + '.'
    };
  }

  function fetchJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // 尝试从后台加载；成功 resolve({products, categories, live:true})，失败 resolve({live:false})
  window.SHIRUN_loadData = function () {
    return Promise.all([
      fetchJSON(API + '/categories'),
      fetchJSON(API + '/products?per_page=60&sort=recommended')
    ]).then(function (rs) {
      var cats = rs[0].data || [];
      var catById = {};
      cats.forEach(function (c) { catById[c.id] = c; });
      var products = (rs[1].data || []).map(function (p) { return normalizeProduct(p, catById); });
      if (!products.length) throw new Error('empty');
      return { products: products, categories: cats, live: true };
    }).catch(function () {
      return { products: window.SHIRUN_PRODUCTS, categories: window.SHIRUN_CATEGORIES, live: false };
    });
  };

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
    if (['recommended', 'colors', 'sku'].indexOf(state.sort) === -1) state.sort = 'recommended';
    var lastList = [];

    var pillsBox = document.querySelector('.fpills');
    var searchEl = document.getElementById('searchInput');
    var sortEl = document.getElementById('sortSelect');
    var countEl = document.getElementById('resultCount');
    var pills = [];

    // 把筛选状态同步到 URL（可分享、刷新保留、后退可用）
    function syncUrl() {
      try {
        var sp = new URLSearchParams();
        if (state.cat && state.cat !== 'all') sp.set('cat', state.cat);
        if (state.q) sp.set('q', state.q);
        if (state.sort !== 'recommended') sp.set('sort', state.sort);
        var qs = sp.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      } catch (e) { /* file:// 等环境限制时静默跳过 */ }
    }

    // 分类 pills 由后台分类动态生成（含产品数）
    function renderPills(categories, products) {
      if (!pillsBox) return;
      var counts = {};
      products.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
      var html = '<button class="fpill" type="button" data-cat="all">All <span>' + products.length + '</span></button>';
      categories.forEach(function (c) {
        var n = counts[c.slug] || 0;
        if (!n) return; // 暂无产品的分类不在前台展示
        html += '<button class="fpill" type="button" data-cat="' + c.slug + '">' +
          (c.name || c.name_en) + ' <span>' + n + '</span></button>';
      });
      pillsBox.innerHTML = html;
      bindPills();
      if (state.cat && !pillsBox.querySelector('.fpill[data-cat="' + state.cat + '"]')) state.cat = 'all';
      if (!state.cat) state.cat = 'all';
      pills.forEach(function (p) { if (p.dataset.cat === state.cat) p.classList.add('is-active'); });
    }

    function bindPills() {
      pills = Array.prototype.slice.call(document.querySelectorAll('.fpill'));
      pills.forEach(function (p) {
        p.addEventListener('click', function () {
          pills.forEach(function (x) { x.classList.remove('is-active'); });
          p.classList.add('is-active');
          state.cat = p.dataset.cat;
          apply();
        });
      });
    }

    function apply() {
      var list = window.SHIRUN_DATA.products.slice();
      if (state.cat && state.cat !== 'all') list = list.filter(function (p) { return p.cat === state.cat; });
      if (state.q) {
        var q = state.q.toLowerCase();
        list = list.filter(function (p) {
          return (p.name + ' ' + p.sku + ' ' + p.tagline).toLowerCase().indexOf(q) !== -1;
        });
      }
      if (state.sort === 'sku') list.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });
      else if (state.sort === 'colors') list.sort(function (a, b) { return colorwayCount(b.colors) - colorwayCount(a.colors); });
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
        var img0 = p.images[0] || { src: '', alt: p.name };
        var link = 'product.html?slug=' + encodeURIComponent(p.slug || p.sku);
        return '<article class="pcard glass reveal ' + d + '">' +
          '<a class="pcard__media pcard__media--single" href="' + link + '" aria-label="View ' + p.name + '">' +
          '<img src="' + img0.src + '" alt="' + img0.alt + '" loading="lazy" width="640" height="480"/></a>' +
          '<div class="pcard__body">' +
          '<p class="pcard__sku">' + p.sku + ' &middot; ' + p.catLabel + '</p>' +
          '<h3><a href="' + link + '">' + p.name + '</a></h3>' +
          '<p>' + p.tagline + '</p>' +
          '<div class="pcard__meta"><span class="pill">' + p.colorsLabel + '</span><span class="pill">OEM / ODM</span><span class="pill">Custom Logo</span></div>' +
          '<a class="pcard__cta" href="' + link + '">View product <span aria-hidden="true">&rarr;</span></a>' +
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

    var debounceTimer;
    searchEl.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { state.q = searchEl.value.trim(); apply(); }, 220);
    });
    // 回车：唯一命中时直达该产品
    searchEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (lastList.length === 1) {
        location.href = 'product.html?slug=' + encodeURIComponent(lastList[0].slug || lastList[0].sku);
      } else if (lastList.length > 1) {
        var first = grid.querySelector('.pcard .pcard__cta');
        if (first) first.focus();
      }
    });
    sortEl.addEventListener('change', function () { state.sort = sortEl.value; apply(); });

    grid.innerHTML = '<div style="padding:48px 0;text-align:center;opacity:.6">Loading products…</div>';
    window.SHIRUN_loadData().then(function (data) {
      window.SHIRUN_DATA = data;
      if (data.live) {
        renderPills(data.categories, data.products); // 分类 pills 来自后台
      } else {
        bindPills(); // 静态兜底：HTML 中写死的 pills
        if (state.cat && !document.querySelector('.fpill[data-cat="' + state.cat + '"]')) state.cat = 'all';
        if (!state.cat) state.cat = 'all';
        pills.forEach(function (p) { if (p.dataset.cat === state.cat) p.classList.add('is-active'); });
      }
      searchEl.value = state.q;
      sortEl.value = state.sort;
      if (sortEl.__luxsync) sortEl.__luxsync();
      apply();
    });
  };

  /* ---------- 产品详情页逻辑 ---------- */
  window.SHIRUN_initDetail = function () {
    var root = document.getElementById('productDetail');
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var slug = params.get('slug') || '';
    var sku = params.get('sku') || (location.hash && location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '');
    var notFound = document.getElementById('pdNotFound');
    var el = function (id) { return document.getElementById(id); };

    function render(p, related) {
      document.title = p.name + ' — ' + p.sku + ' | SHIRUN';
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', p.tagline);

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

      var main = el('pdMain');
      var thumbs = el('pdThumbs');
      if (!main || !thumbs || !p.images.length) return;
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

      var relBox = el('pdRelated');
      if (relBox) relBox.innerHTML = related.map(function (r) {
        var im0 = r.images[0] || { src: '', alt: r.name };
        return '<a class="relcard glass" href="product.html?slug=' + encodeURIComponent(r.slug || r.sku) + '">' +
          '<img src="' + im0.src + '" alt="' + im0.alt + '" loading="lazy" width="200" height="150"/>' +
          '<span class="relcard__sku">' + r.sku + '</span><b>' + r.name + '</b></a>';
      }).join('');
    }

    function findInStatic(key, val) {
      return window.SHIRUN_PRODUCTS.find(function (x) { return x[key] === val; });
    }

    function loadStaticDetail() {
      var p = (sku && findInStatic('sku', sku)) || (slug && findInStatic('slug', slug));
      if (!p) {
        root.hidden = true;
        notFound.hidden = false;
        document.title = 'Product Not Found — SHIRUN';
        return;
      }
      var related = window.SHIRUN_PRODUCTS.filter(function (x) { return x.slug !== p.slug && x.cat === p.cat; })
        .concat(window.SHIRUN_PRODUCTS.filter(function (x) { return x.slug !== p.slug && x.cat !== p.cat; }))
        .slice(0, 3);
      render(p, related);
    }

    if (!slug && !sku) {
      loadStaticDetail();
      return;
    }

    // 优先走后台 API（详情含完整画廊与相关产品）
    var slugKey = slug || sku;
    fetchJSON(API + '/products/' + encodeURIComponent(slugKey)).then(function (rs) {
      return window.SHIRUN_loadData().then(function (data) {
        var cats = {};
        (data.categories || []).forEach(function (c) { cats[c.id] = c; });
        var p = normalizeProduct(rs.data, cats);
        var related = (rs.data.related_products || []).map(function (x) { return normalizeProduct(x, cats); });
        render(p, related);
      });
    }).catch(function () {
      loadStaticDetail(); // API 不可达 → 静态兜底（兼容 ?sku=）
    });
  };

  /* ---------- 自动初始化（按页面元素存在性） ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    window.SHIRUN_initListing();
    window.SHIRUN_initDetail();
  });
})();
