/* ============================================================
   SHIRUN — i18n.js 轻量国际化引擎（零依赖，与站点同风格）
   ------------------------------------------------------------
   词典文件：i18n/lang-en.js、i18n/lang-zh.js
     各自调用 I18N.register('en'|'zh', {...}) 注册；全部
     defer 引入，i18n.js 排第一。词典注册完成后立即应用翻译
     （defer 脚本执行时 DOM 已解析完毕，无闪烁、无等待）。

   标记约定：
     data-i18n="key"                → textContent 替换
     data-i18n-html="key"           → innerHTML 替换（含 <em>/<br> 等标记）
     data-i18n-attr="attr:key;..."  → 属性替换（placeholder / aria-label / title）
     <html data-page="home">        → 页面级 title / meta description 取自 meta.* 词典

   语言判定优先级：?lang= > localStorage(shirun_lang) > 浏览器语言 > en
   切换语言后发布事件：window.dispatchEvent(new CustomEvent('i18n:change'))
   动态渲染方（products.js / cms.js）监听该事件重渲染。
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'shirun_lang';
  var SUPPORTED = ['en', 'zh'];
  var dicts = { en: null, zh: null };
  var registered = 0;
  var lang = 'en';
  var changeListeners = [];
  var booted = false;

  /* ---------- 语言判定 ---------- */
  function detect() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) { /* 隐私模式等 */ }
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && SUPPORTED.indexOf(q) !== -1) return q;
    } catch (e) { /* file:// 等环境 */ }
    var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
    if (nav.indexOf('zh') === 0) return 'zh';
    return 'en';
  }

  function lookup(key) {
    var path = key.split('.');
    function dig(d) {
      var o = d;
      for (var i = 0; i < path.length; i++) {
        if (o == null || typeof o !== 'object') return undefined;
        o = o[path[i]];
      }
      return typeof o === 'string' ? o : undefined;
    }
    return dig(dicts[lang]) || dig(dicts.en);
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
    var page = document.documentElement.getAttribute('data-page') ||
               document.body.getAttribute('data-page') || '';

    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n'));
      if (val != null) el.textContent = val;
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
    updateSwitchers();
  }

  /* ---------- 语言切换器（自动注入导航与移动抽屉） ---------- */
  var SWITCHER_LABEL = { en: '中文', zh: 'EN' };  // 按钮显示“目标语言”

  function buildSwitcher() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-switch';
    btn.setAttribute('aria-label', t('common.langSwitchAria'));
    btn.addEventListener('click', function () {
      setLang(lang === 'en' ? 'zh' : 'en');
    });
    return btn;
  }

  function mountSwitchers() {
    if (mountSwitchers.done) return;
    mountSwitchers.done = true;
    document.querySelectorAll('.nav__actions').forEach(function (box) {
      box.insertBefore(buildSwitcher(), box.firstChild);
    });
    document.querySelectorAll('.drawer__panel').forEach(function (panel) {
      var wa = panel.querySelector('a.btn[href^="https://wa.me"]');
      var btn = buildSwitcher();
      if (wa) panel.insertBefore(btn, wa); else panel.appendChild(btn);
    });
    updateSwitchers();
  }

  function updateSwitchers() {
    document.querySelectorAll('.lang-switch').forEach(function (btn) {
      btn.textContent = SWITCHER_LABEL[lang] || 'EN';
      btn.setAttribute('aria-label', t('common.langSwitchAria'));
      btn.setAttribute('aria-pressed', lang === 'zh' ? 'true' : 'false');
    });
  }

  /* ---------- 公共 API ---------- */
  function setLang(next, opts) {
    if (SUPPORTED.indexOf(next) === -1 || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 忽略 */ }
    applyAll();
    if (!(opts && opts.silent)) {
      changeListeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* 单个监听异常不阻断 */ } });
      window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
    }
  }

  function register(code, dict) {
    if (SUPPORTED.indexOf(code) === -1 || !dict) return;
    if (!dicts[code]) registered++;
    dicts[code] = dict;
    // 全部词典注册完成再渲染，避免语言词典未就绪时回退到英文
    if (!booted && registered >= SUPPORTED.length) boot();
  }

  function boot() {
    booted = true;
    lang = detect();
    mountSwitchers();
    applyAll();
  }

  window.I18N = {
    t: t,
    get lang() { return lang; },
    supported: SUPPORTED.slice(),
    register: register,
    setLang: setLang,
    applyAll: applyAll,
    onChange: function (fn) {
      if (typeof fn === 'function') changeListeners.push(fn);
    },
    /* 供动态渲染层取当前语言（CMS 数据为单语，en 时保持原样） */
    isCMSNative: function () { return lang === 'en'; }
  };

  /* 兜底：若词典因故缺失，DOMContentLoaded 时仍以现有内容渲染 */
  document.addEventListener('DOMContentLoaded', function () {
    if (!booted) boot();
  });
})();
