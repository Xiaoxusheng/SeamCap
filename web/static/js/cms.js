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
     #cmsFeatured / #cmsStaticLines        首页推荐产品 / 静态产品线兜底
     #cmsCraftList / #cmsStaticCraftGrid / #cmsStaticCraftVideos  首页工艺预览
     #cmsValues / #cmsStaticValues、#cmsProcess / #cmsStaticProcess  优势/流程（流程卡可带配图或视频）
     [data-cms-factory]、#cmsContactBlurb、#cmsFooterTag  文案替换
     #cmsCraftModules / #cmsStaticModules  工艺页模块
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/v1';

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
    return '<article class="pcard glass reveal">' +
      '<a class="pcard__media pcard__media--single" href="' + link + '" aria-label="View ' + alt + '">' +
      (src ? '<img src="' + esc(src) + '" alt="' + alt + '" loading="lazy" width="640" height="480"/>' : '') +
      '</a><div class="pcard__body">' +
      '<p class="pcard__sku">' + esc(p.sku || '') + (cat ? ' &middot; ' + esc(cat) : '') + '</p>' +
      '<h3><a href="' + link + '">' + esc(p.name) + '</a></h3>' +
      '<p>' + esc(p.short_desc || '') + '</p>' +
      '<div class="pcard__meta"><span class="pill">' + (n > 1 ? n + ' Colorways' : 'Custom Colourways') + '</span>' +
      '<span class="pill">OEM / ODM</span><span class="pill">Custom Logo</span></div>' +
      '<a class="pcard__cta" href="' + link + '">View product <span aria-hidden="true">&rarr;</span></a>' +
      '</div></article>';
  }

  function craftCard(c) {
    var cover = c.cover_image ? safeURL(c.cover_image.url) : '';
    var href = 'craftsmanship.html#craft-' + encodeURIComponent(c.slug || '');
    return '<article class="pcard glass reveal">' +
      '<a class="pcard__media pcard__media--single" href="' + href + '" aria-label="' + esc(c.title) + '">' +
      (cover ? '<img src="' + esc(cover) + '" alt="' + esc((c.cover_image && c.cover_image.alt_text) || c.title) + '" loading="lazy" width="640" height="480"/>' : '') +
      '</a><div class="pcard__body">' +
      '<p class="pcard__sku">The Craft</p>' +
      '<h3><a href="' + href + '">' + esc(c.title) + '</a></h3>' +
      '<p>' + esc(c.summary || '') + '</p>' +
      '<a class="pcard__cta" href="' + href + '">Read more <span aria-hidden="true">&rarr;</span></a>' +
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
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="640" height="400"/>' : '') +
        '<span class="vcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></span>' +
        '</button>';
    } else if (img) {
      media = '<img class="pstep__img" src="' + esc(img) + '" alt="" loading="lazy" width="640" height="400"/>';
    }
    return '<div class="value glass reveal' + d + '">' + media +
      '<span class="value__num" aria-hidden="true">' + esc(s.step || ('0' + (i + 1))) + '</span>' +
      '<h3>' + esc(s.title || '') + '</h3><p>' + esc(s.desc || '') + '</p></div>';
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
      img.src = safeURL(hero.hero_image.url);
      if (hero.hero_image.alt_text) img.alt = hero.hero_image.alt_text;
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

  function bindHome() {
    var hasHero = document.querySelector('[data-cms-hero]');
    var featuredBox = document.getElementById('cmsFeatured');
    var craftBox = document.getElementById('cmsCraftList');
    if (!hasHero && !featuredBox && !craftBox &&
        !document.getElementById('cmsValues') && !document.getElementById('cmsProcess')) return;

    getJSON('/home').then(function (home) {
      if (!home) return;
      var hero = home.hero || {};
      applyHero(hero);

      // 推荐产品：后台标记 featured 的产品驱动 Collection 板块
      if (featuredBox && home.featured_products && home.featured_products.length) {
        featuredBox.innerHTML = home.featured_products.map(productCard).join('');
        show(featuredBox);
        hide(document.getElementById('cmsStaticLines'));
        reveal(featuredBox);
      }

      // 工艺预览：后台工艺驱动 Craft 板块
      if (craftBox && home.craft_preview && home.craft_preview.length) {
        craftBox.innerHTML = '<div class="cards3">' +
          home.craft_preview.map(craftCard).join('') + '</div>';
        show(craftBox);
        hide(document.getElementById('cmsStaticCraftGrid'));
        hide(document.getElementById('cmsStaticCraftVideos'));
        reveal(craftBox);
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
          ' data-src="' + src + '" data-alt="' + alt + '"' +
          ' aria-label="Show image ' + (j + 1) + ' of ' + seq.length + (alt ? ': ' + alt : '') + '">' +
          '<img src="' + src + '" alt="" loading="lazy" width="160" height="160"/></button>';
      }).join('');
    }

    if (v) {
      var gal = imgs.length
        ? '<div class="craft-thumbs">' + thumbButtons(imgs, -1) + '</div>'
        : '';
      return '<div class="craft-media craft-media--video">' +
        '<div class="vcard glass reveal' + d + '">' +
        '<button class="vcard__stage" type="button" data-video="' + esc(v) + '" aria-label="Play video: ' + esc(c.title) + '">' +
        (cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy" width="640" height="360"/>' : '') +
        '<span class="vcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg></span>' +
        '</button>' +
        '<div class="vcard__body"><b>' + chip + '</b><p>' + esc(c.summary || '') + '</p></div></div>' +
        '<figure class="glass-frame craft-cover" hidden><img alt=""/>' +
        '<button class="craft-back" type="button" aria-label="Back to video">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg>Video</button>' +
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
      '<img src="' + esc(mainSrc) + '" alt="' + coverAlt + '" loading="lazy" width="900" height="640"/>' +
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
  bindCraft();
})();
