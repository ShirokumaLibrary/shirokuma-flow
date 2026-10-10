// ページ全体の対話機能
//  0. サイドバー <aside class="toc"> を JS 生成（テーマトグル + 目次 + ナビゲーション）
//  1. ダークモード切替（localStorage 永続化 + prefers-color-scheme 反映）
//  2. サイドバー TOC を本文の <h2> から自動生成（手書き不要）
//  3. SVG クリック → モーダル拡大（<dialog> ベース、ESC / 背景 / × で閉じる）
//
// ページ HTML 側に必要なのは <main> 本文のみ。親（上位）ページへのリンクが要る場合は
// <body data-parent-href="/explainers/onboarding/" data-parent-label="導入ガイド"> のように定義する。
// ドキュメントルート（/）へのリンクは常に自動付与される。索引ページ（body.index-page）は対象外。

(function () {
  const htmlEl = document.documentElement;
  const lang = (htmlEl.getAttribute('lang') || 'ja').toLowerCase().startsWith('en') ? 'en' : 'ja';
  const t = (ja, en) => (lang === 'en' ? en : ja);

  /* ===== 0. サイドバー（aside.toc）を生成 ===== */
  buildSidebar();

  /* ===== 1. theme toggle ===== */
  const btn   = document.getElementById('theme-toggle');
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  const KEY   = 'explainer-theme';

  const applyTheme = (theme) => {
    htmlEl.setAttribute('data-theme', theme);
    if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
    if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  };
  const stored = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored || (prefersDark ? 'dark' : 'light'));
  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ===== 2. auto TOC（本文の <h2> から目次を生成） =====
     - 対象は <main> 直下の見出し階層 <h2> のみ（h3 以下は対象外）
     - id が無い <h2> には本文から slug を自動付与（既存の手書き id は尊重）
     - 表示テキストは先頭の "N. " 番号を除去（"1. 概要" → "概要"）           */
  (function buildToc() {
    const toc  = document.querySelector('aside.toc');
    const main = document.querySelector('main');
    if (!toc || !main) return;

    const heads = main.querySelectorAll('h2');
    if (heads.length === 0) return;

    const used = Object.create(null);
    const slugify = (text) => {
      // 文字（日本語含む）と数字以外を除去、空白はハイフンに（Unicode property escape）
      let s = text.trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]+/gu, '');
      if (!s) s = 'section';
      if (s in used) { used[s] += 1; s = s + '-' + used[s]; } else { used[s] = 0; }
      return s;
    };

    let ol = toc.querySelector('ol');
    if (!ol) {
      ol = document.createElement('ol');
      const heading = toc.querySelector('h2');
      if (heading && heading.nextSibling) {
        toc.insertBefore(ol, heading.nextSibling);
      } else {
        toc.appendChild(ol);
      }
    }
    ol.innerHTML = '';

    heads.forEach((h) => {
      if (!h.id) h.id = slugify(h.textContent);
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/^\s*\d+\.\s*/, '').trim();
      li.appendChild(a);
      ol.appendChild(li);
    });
  })();

  /* ===== 3. SVG zoom dialog ===== */
  const svgs = document.querySelectorAll('.diagram svg');
  if (svgs.length === 0) return;

  // ダイアログ要素を一度だけ生成
  const dialog = document.createElement('dialog');
  dialog.className = 'svg-zoom';
  dialog.innerHTML = `
    <button class="svg-zoom-close" type="button" aria-label="閉じる">×</button>
    <div class="svg-zoom-body"></div>
    <span class="svg-zoom-hint">ESC または背景クリックで閉じる</span>
  `;
  document.body.appendChild(dialog);
  const body = dialog.querySelector('.svg-zoom-body');

  // 各 SVG にクリックで開くハンドラを付与
  svgs.forEach((svg) => {
    svg.setAttribute('role', 'button');
    svg.setAttribute('tabindex', '0');
    const open = () => {
      body.innerHTML = '';
      body.appendChild(svg.cloneNode(true));
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    };
    svg.addEventListener('click', open);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // 閉じる処理
  dialog.querySelector('.svg-zoom-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    // ダイアログ自身の領域外（backdrop 領域）をクリックで閉じる
    if (e.target === dialog) dialog.close();
  });

  /* ---- サイドバー生成の本体 ---- */
  /**
   * data-parent-href は href シンク。スキームを絞ってから代入する。
   * **落とすのは非 http(s) スキーム**（`javascript:` / `data:` / `vbscript:` など。属性を書けるのは
   * ページ著者なので権限の増分は小さいが、インラインスクリプト検査〔pages-no-inline-style 等〕を
   * 素通りする経路を残さない）。
   * **通すのは** ①`/` 始まりの値をそのまま（`//` 始まりは①では受けない） ②`document.baseURI` に対して
   * http / https に解決される値。②には**プロトコル相対（`//host/x`）・相対パス（`../x` / `#frag`）も入る**
   * ——①で落ちても②で通るので、`//host` を除外しているとは読まないこと。
   * **同一オリジンには限定していない**: 親ナビに別オリジンの絶対 URL を置く構成も通すため、
   * オリジンで絞るとその親ナビが消える。
   */
  function safeNavHref(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim();
    if (v === '') return null;
    if (/^\/(?!\/)/.test(v)) return v;
    try {
      var u = new URL(v, document.baseURI);
      if (u.protocol === 'http:' || u.protocol === 'https:') return v;
    } catch (e) {
      return null;
    }
    return null;
  }

  function buildSidebar() {
    const body = document.body;
    if (!body) return;
    if (body.classList.contains('index-page')) return; // 索引ページは独自レイアウト
    if (document.querySelector('aside.toc')) return;    // 既に存在するならそれを使う
    if (!document.querySelector('main')) return;        // 本文が無いページは対象外

    const aside = document.createElement('aside');
    aside.className = 'toc';

    // テーマトグル
    const toggle = document.createElement('button');
    toggle.id = 'theme-toggle';
    toggle.className = 'theme-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', t('テーマ切替', 'Toggle theme'));
    const ti = document.createElement('span');
    ti.className = 'icon';
    ti.id = 'theme-icon';
    ti.textContent = '🌙';
    const tl = document.createElement('span');
    tl.id = 'theme-label';
    tl.textContent = 'Dark mode';
    toggle.appendChild(ti);
    toggle.appendChild(tl);
    aside.appendChild(toggle);

    // 目次見出し
    const heading = document.createElement('h2');
    heading.textContent = t('目次', 'Contents');
    aside.appendChild(heading);

    // 目次本体（buildToc が後で埋める）
    aside.appendChild(document.createElement('ol'));

    // ナビゲーション: ドキュメントルート（常時）+ 親ページ（定義時のみ）
    const nav = document.createElement('nav');
    nav.className = 'toc-nav';
    const rootLink = document.createElement('a');
    rootLink.href = '/';
    rootLink.className = 'toc-nav-root';
    rootLink.textContent = t('🏠 ドキュメントルート', '🏠 Documentation root');
    nav.appendChild(rootLink);

    const parentHref = safeNavHref(body.getAttribute('data-parent-href'));
    if (parentHref) {
      const parentLink = document.createElement('a');
      parentLink.href = parentHref;
      parentLink.className = 'toc-nav-parent';
      parentLink.textContent = '← ' + (body.getAttribute('data-parent-label') || t('索引', 'Index'));
      nav.appendChild(parentLink);
    }
    aside.appendChild(nav);

    body.insertBefore(aside, body.firstChild);
  }
})();
