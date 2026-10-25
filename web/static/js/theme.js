/* ============================================================
   SHIRUN — 主题（白天 / 夜间）
   ------------------------------------------------------------
   阻塞加载（放在 <head>，非 defer）：在首次绘制前把 data-theme 写到
   <html> 上，避免夜间用户刷新时闪一帧白底。
   优先级：localStorage(shirun_theme) > 系统 prefers-color-scheme > dark
   用户一旦手动切换就记住，不再跟随系统；清除记录后恢复跟随。
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'shirun_theme';
  var root = document.documentElement;
  var THEME_COLOR = { dark: '#0C0A09', light: '#F6F2E9' };

  function readSaved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
    if (persist) {
      try { localStorage.setItem(KEY, theme); } catch (e) { /* 隐私模式忽略 */ }
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  apply(readSaved() || systemTheme(), false);

  window.ShirunTheme = {
    current: function () { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; },
    set: function (t) { apply(t === 'light' ? 'light' : 'dark', true); },
    toggle: function () { this.set(this.current() === 'light' ? 'dark' : 'light'); },
    /* 放弃手动选择，回到跟随系统 */
    followSystem: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
      apply(systemTheme(), false);
    }
  };

  // 系统主题变化时，仅在用户没有手动选择的情况下跟随
  try {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function (e) {
      if (!readSaved()) apply(e.matches ? 'light' : 'dark', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch (e) { /* 老浏览器忽略 */ }
})();
