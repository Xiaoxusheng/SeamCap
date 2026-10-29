/* ============================================================
   SHIRUN — 单语（英文）文案层
   ------------------------------------------------------------
   词典：i18n/lang-en.js，调用 I18N.register('en', {...}) 注册；
   所有页面先加载 i18n.js、再加载词典（均 defer），词典就绪即应用。
   站点只提供英文：不做浏览器语言探测，也没有语言切换入口。

   标记约定：
     data-i18n="key"                → textContent 替换
     data-i18n-html="key"           → innerHTML 替换（含 <em>/<br> 等标记）
     data-i18n-attr="attr:key;..."  → 属性替换（placeholder / aria-label / title）
     <html data-page="home">        → 页面级 title / meta description 取自 meta.* 词典
   ============================================================ */
(function () {
  'use strict';

  var dict = null;
  var booted = false;

  function lookup(key) {
    var path = key.split('.');
    var o = dict;
    for (var i = 0; i < path.length; i++) {
      if (o == null || typeof o !== 'object') return undefined;
      o = o[path[i]];
    }
    return typeof o === 'string' ? o : undefined;
  }

  /* ---------- 取词（支持 {n} 占位） ---------- */
  function t(key, vars) {
    var val = lookup(key);
    if (val == null) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        val = val.split('{' + k + '}').join(vars[k]);
      });
    }
    return val;
  }

  /* ---------- 应用到 DOM ---------- */
  function applyAttrs(el) {
    var pairs = el.getAttribute('data-i18n-attr').split(';');
    pairs.forEach(function (pair) {
      var p = pair.split(':');
      if (p.length !== 2) return;
      var attr = p[0].trim();
      var key = p[1].trim();
      if (attr && key) el.setAttribute(attr, t(key));
    });
  }

  function applyAll() {
    if (!dict) return; // 词典缺失时保留 HTML 内已有英文，避免把 key 写进页面
    var page = document.documentElement.getAttribute('data-page') ||
               document.body.getAttribute('data-page') || '';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var val = lookup(el.getAttribute('data-i18n-html'));
      if (val != null) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(applyAttrs);

    if (page) {
      var title = lookup('meta.' + page + '.title');
      if (title) document.title = title;
      var desc = lookup('meta.' + page + '.desc');
      var meta = document.querySelector('meta[name="description"]');
      if (desc && meta) meta.setAttribute('content', desc);
    }
  }

  /* ---------- 公共 API ---------- */
  function register(code, next) {
    if (code !== 'en' || !next) return;
    dict = next;
    if (!booted) boot();
  }

  function boot() {
    booted = true;
    applyAll();
  }

  window.I18N = {
    t: t,
    lang: 'en',
    supported: ['en'],
    register: register,
    setLang: function () {}, // 单语站点：保留空实现，避免调用方报错
    applyAll: applyAll,
    onChange: function () {} // 无语言切换，动态渲染方无需重渲染
  };
})();
