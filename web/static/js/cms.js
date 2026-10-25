/* ============================================================
   SHIRUN — CMS 数据接通层（渐进增强）
   从后台 API 拉取站点设置 / 页面 / 首页 / 工艺数据渲染前台；
   API 不可达或数据为空时保持 HTML 静态兜底（与 products.js 同模式）。
   依赖：无；所有页面 defer 引入（置于 main.js 之后）。
   接入约定：
     data-cms-page="{slug}"        页面正文注入容器（about/privacy）
     data-cms-page-title="{slug}"  页面 hero 标题替换
     data-cms-contact="whatsapp|address"  联系信息行
     data-cms-hero="title|lead|image|cta1|cta2"  首页 Hero
     [data-cms-circle-image]               首页 The Shirun Circle 板块配图
     #cmsFeatured / #cmsStaticLines        首页推荐产品 / 静态产品线兜底
     img[data-cms-visor="{slug}"]          首页遮阳帽陈列区图片（取该产品后台主图）
     #cmsPackingTeaser                     首页发货展示（/home 的 hero.packing_feature，后台挑选）
     #cmsValues / #cmsStaticValues、#cmsProcess / #cmsStaticProcess  优势/流程（流程卡可带配图或视频）
     [data-cms-factory]、#cmsContactBlurb、#cmsFooterTag  文案替换
     #cmsCraftModules / #cmsStaticModules  工艺页模块
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/v1';
  var thumbURL = window.SHIRUN_thumbURL; // 低带宽优化：/uploads/ 图按展示宽度请求缩放版本

  function t(key, vars) { return window.I18N ? window.I18N.t(key, vars) : key; }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  // 数据层配色标签本地化（与 products.js 同规则）
  function localizeColors(label) {
    if (!label) return label;
    var s = String(label).trim();
    var m = /^(\d+)\s+Colorways?$/i.exec(s);
    if (m) return t('js.colorwaysN', { n: m[1] });
    if (s === 'Two-Tone Options') return t('js.twoTone');
    if (s === 'Custom Colourways') return t('js.customColourways');
    return s;
  }

  /* ---------- 工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // URL 协议白名单：仅 http(s)、协议相对、站内绝对/锚点
  function safeURL(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:)?\/\//i.test(u) || u.charAt(0) === '/' || u.charAt(0) === '#') return u;
    return '';
  }

  function getJSON(path) {
    return fetch(API + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return j && j.data; });
  }

  // 显隐控制：hidden 属性会被 .cards3/.grid4/.videos 等类的显式 display 覆盖，
  // 因此同时写 inline style（优先级最高），双保险
  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = '';
  }
  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = 'none';
  }

  // 动态渲染的 .reveal 元素需要单独触发显现动画
  function reveal(scope) {
    var els = scope.querySelectorAll('.reveal');
    if (!els.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 12% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // 动态渲染的视频卡点击播放（与 main.js 静态绑定逻辑一致）
  function bindVideos(scope) {
    scope.querySelectorAll('.vcard__stage, .pstep__stage').forEach(function (stage) {
      stage.addEventListener('click', function () {
        if (stage.classList.contains('is-playing')) return;
        var src = stage.getAttribute('data-video');
        if (!src) return;
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.src = src;
        stage.appendChild(video);
        stage.classList.add('is-playing');
        var p = video.play();
        if (p && p.catch) { p.catch(function () { /* 自动播放被拒：用户手动点击控件 */ }); }
      });
    });
  }

  function colorwayCount(p) {
    var c = p.colors;
    if (typeof c === 'number') return c;
    if (!c) return 0;
    return String(c).split(',').filter(function (s) { return s.trim(); }).length;
  }

  /* ---------- 1. 站点设置：全站 WhatsApp 号码 / 地址 ---------- */

  function bindSite() {
    return getJSON('/site').then(function (s) {
      if (!s) return;
      var num = String(s.whatsapp || '').replace(/[^0-9]/g, '');
      if (num) {
        // 重写所有 wa.me 链接的号码部分，保留各自预填文案
        document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function (a) {
          try {
            var u = new URL(a.href);
            u.hostname = 'wa.me';
            u.pathname = '/' + num;
            a.href = u.href;
          } catch (e) { /* 异常 href 跳过 */ }
        });
        document.querySelectorAll('[data-cms-contact="whatsapp"]').forEach(function (a) {
          a.textContent = s.whatsapp;
        });
      }
      document.querySelectorAll('[data-cms-contact="address"]').forEach(function (el) {
        if (s.address) el.textContent = s.address;
      });
    }).catch(function () { /* 静态兜底 */ });
  }

  /* ---------- 2. 页面管理 → 前台 about / privacy ---------- */

  function bindPages() {
    var zones = document.querySelectorAll('[data-cms-page]');
    if (!zones.length) return;
    zones.forEach(function (zone) {
      var slug = zone.getAttribute('data-cms-page');
      if (!slug) return;
      getJSON('/pages/' + encodeURIComponent(slug)).then(function (p) {
        if (!p) return;
        var bodyBox = zone.querySelector('[data-cms-body]');
        if (bodyBox && p.body) {
          bodyBox.innerHTML = p.body; // 受控 HTML：服务端已白名单过滤
          show(zone);
          reveal(zone);
          // 后台已有正文 → 隐藏静态兜底板块，避免内容重复
          hide(document.querySelector('[data-cms-static-for="' + slug + '"]'));
        }
        var heroTitle = document.querySelector('[data-cms-page-title="' + slug + '"]');
        if (heroTitle && p.title) heroTitle.textContent = p.title;
        if (p.seo_desc) {
          var m = document.querySelector('meta[name="description"]');
          if (m) m.setAttribute('content', p.seo_desc);
        }
        if (p.title) document.title = p.title + ' | SHIRUN Headwear';
      }).catch(function () { /* 静态兜底 */ });
    });
  }

  /* ---------- 3. 首页内容管理 → 前台首页 ---------- */

  function productCard(p) {
    var img = (p.images && p.images[0]) || p.main_image;
    var src = img ? safeURL(img.url) : '';
    var alt = esc((img && (img.alt_text || img.original_name)) || p.name);
    var slug = encodeURIComponent(p.slug || p.sku || '');
    var cat = (p.category && (p.category.name_en || p.category.name)) || '';
    var n = colorwayCount(p);
    var link = 'product.html?slug=' + slug;
    var colorsLabel = n > 1 ? t('js.colorwaysN', { n: n }) : t('js.customColourways');
    return '<article class="pcard glass reveal">' +
      '<a class="pcard__media pcard__media--single" href="' + link + '" aria-label="' + escAttr(t('js.viewAria', { name: p.name })) + '">' +
      (src ? '<img src="' + esc(thumbURL(src, 640)) + '" alt="' + alt + '" loading="lazy" width="640" height="480"/>' : '') +
      '</a><div class="pcard__body">' +
      '<p class="pcard__sku">' + esc(p.sku || '') + (cat ? ' &middot; ' + esc(cat) : '') + '</p>' +
      '<h3><a href="' + link + '">' + esc(p.name) + '</a></h3>' +
      '<p>' + esc(p.short_desc || '') + '</p>' +
      '<div class="pcard__meta"><span class="pill">' + colorsLabel + '</span>' +
      '<span class="pill">OEM / ODM</span><span class="pill">' + t('home.pillLogo') + '</span></div>' +
      '<a class="pcard__cta" href="' + link + '">' + t('js.viewProduct') + ' <span aria-hidden="true">&rarr;</span></a>' +
      '</div></article>';
  }

  function craftCard(c) {
    var cover = c.cover_image ? safeURL(c.cover_image.url) : '';
    var href = 'craftsmanship.html#craft-' + encodeURIComponent(c.slug || '');
    return '<article class="pcard glass reveal">' +
      '<a class="pcard__media pcard__media--single" href="' + href + '" aria-label="' + esc(c.title) + '">' +
      (cover ? '<img src="' + esc(thumbURL(cover, 640)) + '" alt="' + esc((c.cover_image && c.cover_image.alt_text) || c.title) + '" loading="lazy" width="640" height="480"/>' : '') +
      '</a><div class="pcard__body">' +
      '<p class="pcard__sku">' + t('js.theCraft') + '</p>' +
      '<h3><a href="' + href + '">' + esc(c.title) + '</a></h3>' +
      '<p>' + esc(c.summary || '') + '</p>' +
      '<a class="pcard__cta" href="' + href + '">' + t('js.readMore') + ' <span aria-hidden="true">&rarr;</span></a>' +
      '</div></article>';
  }

  var ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  function valueCard(item, i, num) {
    var d = i % 4 ? ' reveal--d' + (i % 4) : '';
    return '<div class="value glass reveal' + d + '">' +
      '<span class="value__num" aria-hidden="true">' + esc(num) + '</span>' +
      '<h3>' + esc(item.title || '') + '</h3><p>' + esc(item.desc || '') + '</p></div>';
  }

  // 流程步骤卡：可选配图/视频（视频优先播放、配图作封面），媒体通栏贴卡片顶部
  function processCard(s, i) {
    var d = i % 4 ? ' reveal--d' + (i % 4) : '';
    var img = safeURL(s.image);
    var vid = safeURL(s.video_url);
    var media = '';
    if (vid) {
      media = '<button class="pstep__stage" type="button" data-video="' + esc(vid) + '"' +
        ' aria-label="Play process video ' + (i + 1) + '">' +
        (img ? '<img src="' + esc(thumbURL(img, 640)) + '" alt="" loading="lazy" width="640" height="400"/>' : '') +
        '<span class="vcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></span>' +
        '</button>';
    } else if (img) {
      media = '<img class="pstep__img" src="' + esc(thumbURL(img, 640)) + '" alt="" loading="lazy" width="640" height="400"/>';
    }
    // 后台流程步骤没有 title 字段（model.ProcessStep 只有 step/desc/image/video_url），
    // 缺失时回退到既有词典里的四步标题，避免渲染出空 h3 留下空档
    var stepTitle = s.title || (i < 4 ? t('home.step' + (i + 1) + 'Title') : '');
    return '<div class="value glass reveal' + d + '">' + media +
      '<span class="value__num" aria-hidden="true">' + esc(s.step || ('0' + (i + 1))) + '</span>' +
      (stepTitle ? '<h3>' + esc(stepTitle) + '</h3>' : '') +
      '<p>' + esc(s.desc || '') + '</p></div>';
  }

  function applyHero(hero) {
    if (!hero) return;
    var t = document.querySelector('[data-cms-hero="title"]');
    if (t && hero.hero_title) t.textContent = hero.hero_title;
    var l = document.querySelector('[data-cms-hero="lead"]');
    if (l && hero.hero_subtitle) l.textContent = hero.hero_subtitle;

    var img = document.querySelector('[data-cms-hero="image"]');
    var videoURL = safeURL(hero.hero_video_url);
    if (img && videoURL) {
      var v = document.createElement('video');
      v.controls = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.src = videoURL;
      v.style.width = '100%';
      v.style.display = 'block';
      v.style.borderRadius = 'inherit';
      img.replaceWith(v);
    } else if (img && hero.hero_image && hero.hero_image.url) {
      img.src = thumbURL(safeURL(hero.hero_image.url), 960);
      if (hero.hero_image.alt_text) img.alt = hero.hero_image.alt_text;
    }

    // The Shirun Circle 板块配图（后台「首页设置」管理；为空时保留静态兜底图）
    var cimg = document.querySelector('[data-cms-circle-image]');
    if (cimg && hero.circle_image && hero.circle_image.url) {
      var cUrl = safeURL(hero.circle_image.url);
      if (cUrl) cimg.src = thumbURL(cUrl, 960);
    }

    [['cta1', hero.cta1_text, hero.cta1_url], ['cta2', hero.cta2_text, hero.cta2_url]].forEach(function (pair) {
      var a = document.querySelector('[data-cms-hero="' + pair[0] + '"]');
      if (!a) return;
      if (pair[1]) a.textContent = pair[1];
      var u = safeURL(pair[2]);
      if (u) {
        a.href = u;
        if (u.charAt(0) === '#') { a.removeAttribute('target'); }
        else if (!/^https?:/i.test(u) && u.charAt(0) !== '/') { /* 异常：不动 */ }
      }
    });
  }

  /* ---------- 3.5 首页工厂实景图库（The House 板块，后台 story_media 驱动） ---------- */

  // items: [{kind:'image'|'video', url}]；标题芯片克隆静态兜底里已本地化的文案
  function storyGalleryHTML(items) {
    var seq = (items || []).filter(function (it) { return it && safeURL(it.url); });
    if (!seq.length) return '';

    var staticChip = document.querySelector('#storyStaticMedia .glass-chip');
    var chipHTML = staticChip ? staticChip.innerHTML : '<strong>Real Production</strong>';

    var first = seq[0];
    var firstSrc = safeURL(first.url);
    var stageInner = first.kind === 'video'
      ? '<video src="' + esc(firstSrc) + '" controls playsinline preload="metadata" aria-label="Factory video"></video>'
      : '<img src="' + esc(thumbURL(firstSrc, 960)) + '" alt="Real production floor" loading="lazy" width="1200" height="900"/>';

    var thumbs = seq.map(function (it, j) {
      var u = safeURL(it.url);
      var active = j === 0 ? ' is-active' : '';
      if (it.kind === 'video') {
        return '<button class="sgallery__thumb sgallery__thumb--video' + active + '" type="button" data-kind="video" data-src="' + esc(u) + '"' +
          ' aria-label="Play factory video">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></button>';
      }
      return '<button class="sgallery__thumb' + active + '" type="button" data-kind="image" data-src="' + esc(thumbURL(u, 960)) + '"' +
        ' aria-label="Show factory photo ' + (j + 1) + ' of ' + seq.length + '">' +
        '<img src="' + esc(thumbURL(u, 160)) + '" alt="" loading="lazy" width="160" height="160"/></button>';
    }).join('');

    return '<figure class="glass-frame sgallery__stage reveal reveal--d1">' + stageInner +
      '<figcaption class="glass-chip">' + chipHTML + '</figcaption></figure>' +
      '<div class="sgallery__thumbs">' + thumbs + '</div>';
  }

  // 缩略图切换：点击换主舞台（图片/视频）；离开视频时暂停播放
  function bindStoryGallery(scope) {
    var thumbs = scope.querySelectorAll('button.sgallery__thumb');
    var stage = scope.querySelector('.sgallery__stage');
    if (!thumbs.length || !stage) return;
    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-active')) return;
        var oldVideo = stage.querySelector('video');
        if (oldVideo) { try { oldVideo.pause(); } catch (e) { /* noop */ } }
        thumbs.forEach(function (x) { x.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var chip = stage.querySelector('figcaption');
        var chipHTML = chip ? chip.outerHTML : '';
        var kind = btn.getAttribute('data-kind');
        var src = safeURL(btn.getAttribute('data-src'));
        if (!src) return;
        if (kind === 'video') {
          stage.innerHTML = '<video src="' + esc(src) + '" controls playsinline preload="metadata" aria-label="Factory video"></video>' + chipHTML;
        } else {
          stage.innerHTML = '<img src="' + esc(src) + '" alt="Real production floor" loading="lazy" width="1200" height="900"/>' + chipHTML;
        }
      });
    });
  }

  /* ---------- 3.6 首页发货展示板块（后台「打包发货」素材驱动，/api/v1/packing） ---------- */

  var PACK_CATS = [
    { key: 'packing', label: 'packing.catPacking', fallback: 'Packing' },
    { key: 'loading', label: 'packing.catLoading', fallback: 'Loading' },
    { key: 'warehouse', label: 'packing.catWarehouse', fallback: 'Warehouse' }
  ];

  function packCatLabel(key) {
    var c = PACK_CATS.filter(function (x) { return x.key === key; })[0];
    return esc(c ? t(c.label, c.fallback) : t('packing.catPacking', 'Packing'));
  }

  function packTeaserCard(it) {
    var m = it.media || {};
    var u = safeURL(m.url);
    if (!u) return '';
    var alt = esc(m.alt_text || it.title || 'Packing and dispatch');
    var media;
    if (m.mime_type && m.mime_type.indexOf('video') === 0) {
      media = '<video class="pack-item__media" src="' + esc(u) + '#t=0.6" preload="metadata" muted playsinline' +
        (m.width && m.height ? ' width="' + m.width + '" height="' + m.height + '"' : '') + '></video>';
    } else {
      media = '<img class="pack-item__media" src="' + esc(thumbURL(u, 640)) + '" alt="' + alt + '" loading="lazy" decoding="async"' +
        (m.width && m.height ? ' width="' + m.width + '" height="' + m.height + '"' : '') + '/>';
    }
    return '<a class="pack-item" href="packing.html">' +
      '<span class="pack-item__stage">' + media + '</span>' +
      '<span class="pack-item__meta"><span class="pack-item__cat">' + packCatLabel(it.category) + '</span>' +
      (it.title ? '<b class="pack-item__title">' + esc(it.title) + '</b>' : '') +
      (it.caption ? '<span class="pack-item__cap">' + esc(it.caption) + '</span>' : '') +
      '</span></a>';
  }

  // 首页发货展示：数据来自 /home 的 hero.packing_feature（后台「首页内容→首页发货展示」挑选；
  // 未挑选时后端默认取前 3 条已发布素材）
  function renderPackingTeaser(items) {
    var box = document.getElementById('cmsPackingTeaser');
    var section = document.getElementById('packing-teaser');
    if (!box || !section) return;
    if (!items || !items.length) return; // 无素材时整个板块保持隐藏
    var html = items.map(packTeaserCard).join('');
    if (!html) return;
    box.innerHTML = html;
    show(section);
    show(box);
    reveal(section);
  }

  function bindHome() {
    var hasHero = document.querySelector('[data-cms-hero]');
    var featuredBox = document.getElementById('cmsFeatured');
    if (!hasHero && !featuredBox && !document.getElementById('cmsStoryMedia') &&
        !document.getElementById('cmsPackingTeaser') &&
        !document.getElementById('cmsValues') && !document.getElementById('cmsProcess')) return;

    getJSON('/home').then(function (home) {
      if (!home) return;
      var hero = home.hero || {};
      applyHero(hero);

      // 工厂实景图库：后台 story_media 驱动 The House 板块（图片+视频、缩略图切换）
      var smBox = document.getElementById('cmsStoryMedia');
      if (smBox && hero.story_media && hero.story_media.length) {
        smBox.innerHTML = storyGalleryHTML(hero.story_media);
        if (smBox.innerHTML) {
          show(smBox);
          hide(document.getElementById('storyStaticMedia'));
          bindStoryGallery(smBox);
          reveal(smBox);
        }
      }

      // 发货展示：后台挑选条目（packing_feature 已由后端按顺序解析）
      renderPackingTeaser(hero.packing_feature);

      // 推荐产品：后台标记 featured 的产品驱动 Collection 板块
      if (featuredBox && home.featured_products && home.featured_products.length) {
        featuredBox.innerHTML = home.featured_products.map(productCard).join('');
        show(featuredBox);
        hide(document.getElementById('cmsStaticLines'));
        reveal(featuredBox);
      }

      // 优势 / 流程（字段位于 hero 子对象）
      var advBox = document.getElementById('cmsValues');
      if (advBox && hero.advantages && hero.advantages.length) {
        advBox.innerHTML = hero.advantages.map(function (a, i) {
          return valueCard(a, i, ROMANS[i] || String(i + 1));
        }).join('');
        show(advBox);
        hide(document.getElementById('cmsStaticValues'));
        reveal(advBox);
      }
      var procBox = document.getElementById('cmsProcess');
      if (procBox && hero.process_steps && hero.process_steps.length) {
        procBox.innerHTML = hero.process_steps.map(processCard).join('');
        show(procBox);
        hide(document.getElementById('cmsStaticProcess'));
        reveal(procBox);
        bindVideos(procBox);
      }

      // 文案替换（非空才生效）
      if (hero.factory_intro) {
        var fi = document.querySelector('[data-cms-factory]');
        if (fi) fi.textContent = hero.factory_intro;
      }
      if (hero.contact_blurb) {
        var cb = document.getElementById('cmsContactBlurb');
        if (cb) { cb.textContent = hero.contact_blurb; show(cb); }
      }
      if (hero.footer_text) {
        var ft = document.getElementById('cmsFooterTag');
        if (ft) ft.textContent = hero.footer_text;
      }
    }).catch(function () { /* 静态兜底 */ });
  }

  /* ---------- 3b. 首页遮阳帽陈列区：图片由后台产品主图驱动 ---------- *
   * 该区块的文案与结构保持静态（含 i18n 词典），只把图片替换为后台主图，
   * 这样在后台改「产品 → 主图」即可同步首页，无需改 HTML。
   * 映射：img[data-cms-visor="{slug}"] → products.main_image（缺省回退图库首图）。 */
  function bindVisorImages() {
    var nodes = document.querySelectorAll('[data-cms-visor]');
    if (!nodes.length) return;
    getJSON('/products?per_page=60').then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      var bySlug = {};
      list.forEach(function (p) { if (p && p.slug) bySlug[p.slug] = p; });
      Array.prototype.forEach.call(nodes, function (img) {
        var p = bySlug[img.getAttribute('data-cms-visor')];
        if (!p) return;
        var m = p.main_image || (p.images && p.images.length ? p.images[0] : null);
        if (!m || !m.url) return;
        var u = safeURL(m.url);
        if (!u) return;
        img.src = thumbURL ? thumbURL(u, 960) : u;
        img.alt = m.alt_text || p.name || img.alt;
      });
    }).catch(function () { /* 静态兜底 */ });
  }

  /* ---------- 4. 工艺管理 → 工艺页模块 ---------- */

  // 工艺媒体区：视频模块=视频卡（可被缩略图临时替换为图片，再点一次切回视频）+ 画廊缩略图；
  // 图片模块=主图（封面，缺省取画廊首张）+ 可点击缩略图；封面不在画廊时并入序列首位（URL 去重）
  function craftMedia(c, i) {
    var chip = esc((i < 9 ? '0' : '') + (i + 1) + ' / ' + (c.title || ''));
    var cover = c.cover_image ? safeURL(c.cover_image.url) : '';
    var coverAlt = esc((c.cover_image && c.cover_image.alt_text) || c.title || '');
    var d = i % 2 ? '' : ' reveal--d1';
    var v = safeURL(c.video_url);
    var imgs = (c.images || []).filter(function (m) {
      return m && safeURL(m.url) && !String(m.mime_type || '').startsWith('video');
    });

    function thumbButtons(seq, activeIdx) {
      return seq.map(function (m, j) {
        var src = esc(safeURL(m.url));
        var alt = esc(m.alt_text || m.original_name || '');
        return '<button class="craft-thumb' + (j === activeIdx ? ' is-active' : '') + '" type="button"' +
          ' data-src="' + esc(thumbURL(safeURL(m.url), 960)) + '" data-alt="' + alt + '"' +
          ' aria-label="Show image ' + (j + 1) + ' of ' + seq.length + (alt ? ': ' + alt : '') + '">' +
          '<img src="' + esc(thumbURL(safeURL(m.url), 160)) + '" alt="" loading="lazy" width="160" height="160"/></button>';
      }).join('');
    }

    if (v) {
      var gal = imgs.length
        ? '<div class="craft-thumbs">' + thumbButtons(imgs, -1) + '</div>'
        : '';
      return '<div class="craft-media craft-media--video">' +
        '<div class="vcard glass reveal' + d + '">' +
        '<button class="vcard__stage" type="button" data-video="' + esc(v) + '" aria-label="Play video: ' + esc(c.title) + '">' +
        (cover ? '<img src="' + esc(thumbURL(cover, 640)) + '" alt="" loading="lazy" width="640" height="360"/>' : '') +
        '<span class="vcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></span>' +
        '</button>' +
        '<div class="vcard__body"><b>' + chip + '</b><p>' + esc(c.summary || '') + '</p></div></div>' +
        '<figure class="glass-frame craft-cover" hidden><img alt=""/>' +
        '<button class="craft-back" type="button" aria-label="' + escAttr(t('js.backToVideo')) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg>' + t('js.videoBack') + '</button>' +
        '</figure>' +
        gal + '</div>';
    }

    var seq = imgs.slice();
    if (cover && !seq.some(function (m) { return safeURL(m.url) === cover; })) {
      seq.unshift(c.cover_image);
    }
    var mainSrc = cover || (seq[0] ? safeURL(seq[0].url) : '');
    if (!mainSrc && !seq.length) return '<div aria-hidden="true"></div>';

    var activeIdx = 0;
    for (var k = 0; k < seq.length; k++) {
      if (safeURL(seq[k].url) === mainSrc) { activeIdx = k; break; }
    }

    return '<div class="craft-media">' +
      '<figure class="glass-frame craft-cover reveal' + d + '">' +
      '<img src="' + esc(thumbURL(mainSrc, 960)) + '" alt="' + coverAlt + '" loading="lazy" width="900" height="640"/>' +
      '<figcaption class="glass-chip"><strong>' + chip + '</strong></figcaption></figure>' +
      '<div class="craft-thumbs">' + thumbButtons(seq, activeIdx) + '</div></div>';
  }

  // 画廊缩略图交互：图片模块点击换主图；视频模块点击把视频临时替换为图片，
  // 点「Video」按钮或再次点击同一张切回视频
  function bindCraftGallery(scope) {
    scope.querySelectorAll('.craft-module').forEach(function (mod) {
      var thumbs = mod.querySelectorAll('button.craft-thumb');
      if (!thumbs.length) return;
      var vcard = mod.querySelector('.vcard');
      var videoStage = mod.querySelector('.vcard__stage');
      var coverFrame = mod.querySelector('.craft-cover');
      var coverImg = coverFrame ? coverFrame.querySelector('img') : null;

      function showVideo() {
        thumbs.forEach(function (x) { x.classList.remove('is-active'); });
        coverFrame.hidden = true;
        vcard.hidden = false;
      }

      thumbs.forEach(function (t) {
        t.addEventListener('click', function () {
          var wasActive = t.classList.contains('is-active');
          if (wasActive && videoStage) { showVideo(); return; }
          thumbs.forEach(function (x) { x.classList.remove('is-active'); });
          t.classList.add('is-active');
          if (coverImg) {
            coverImg.src = t.getAttribute('data-src');
            var alt = t.getAttribute('data-alt');
            if (alt) coverImg.alt = alt;
          }
          if (videoStage) {
            vcard.hidden = true;
            coverFrame.hidden = false;
          }
        });
      });

      var back = mod.querySelector('.craft-back');
      if (back && videoStage) back.addEventListener('click', showVideo);
    });
  }

  function bindCraft() {
    var box = document.getElementById('cmsCraftModules');
    if (!box) return;
    getJSON('/craftsmanship').then(function (list) {
      if (!list || !list.length) return;
      box.innerHTML = list.map(function (c, i) {
        var flip = i % 2 === 1 ? ' craft-module--flip' : '';
        var media = craftMedia(c, i);
        var copy = '<div class="craft-module__copy reveal' + (i % 2 ? '' : ' reveal--d1') + '">' +
          (c.body ? c.body : '<p>' + esc(c.summary || '') + '</p>') + '</div>';
        return '<section class="section section--tight" id="craft-' + encodeURIComponent(c.slug || '') + '">' +
          '<div class="wrap craft-module' + flip + '">' + media + copy + '</div></section>';
      }).join('');
      show(box);
      hide(document.getElementById('cmsStaticModules'));
      bindVideos(box);
      bindCraftGallery(box);
      reveal(box);
    }).catch(function () { /* 静态兜底 */ });
  }

  /* ---------- 启动 ---------- */
  bindSite();
  bindPages();
  bindHome();
  bindVisorImages();
  bindCraft();

  /* ---------- 语言切换：重新拉取 CMS 内容（覆盖 i18n 词典占位，CMS 数据优先） ---------- */
  if (window.I18N) {
    var refreshTimer = null;
    window.I18N.onChange(function () {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () {
        bindSite();
        bindPages();
        bindHome();
        bindCraft();
      }, 120);
    });
  }
})();
