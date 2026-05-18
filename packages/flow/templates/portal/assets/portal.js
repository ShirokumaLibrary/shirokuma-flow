// ポータル クライアントサイドスクリプト

// === サイドバー制御 ===

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;

  const isOpen = !sidebar.classList.contains('-translate-x-full');
  if (isOpen) {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  } else {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  }
}

// === 検索機能 ===

let searchIndex = null;
let searchTimeout = null;
let selectedIndex = -1;
let searchResults = [];

async function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  try {
    const res = await fetch('/search-index.json');
    if (res.ok) {
      searchIndex = await res.json();
    }
  } catch {
    searchIndex = { items: [] };
  }
  return searchIndex;
}

function openSearch() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  if (!modal || !input) return;

  modal.classList.remove('hidden');
  input.focus();
  input.value = '';
  selectedIndex = -1;
  renderSearchResults([]);
}

function closeSearch() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.classList.add('hidden');
}

function onSearchInput(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const index = await loadSearchIndex();
    if (!index) return;

    const results = performSearch(index, query, 20);
    searchResults = results;
    selectedIndex = -1;
    renderSearchResults(results);
  }, 150);
}

function onSearchKeydown(e) {
  if (e.key === 'Escape') {
    closeSearch();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
    updateSelectedResult();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, -1);
    updateSelectedResult();
  } else if (e.key === 'Enter') {
    if (selectedIndex >= 0 && searchResults[selectedIndex]) {
      window.location.href = searchResults[selectedIndex].path;
    }
  }
}

function performSearch(index, query, limit) {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();

  return index.items
    .map((item) => {
      let score = fuzzyScore(q, item.title) * 3;
      score += fuzzyScore(q, item.description) * 1.5;
      if (item.module) score += fuzzyScore(q, item.module) * 2;
      for (const keyword of (item.keywords || [])) {
        score += fuzzyScore(q, keyword);
      }
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = (text || '').toLowerCase();
  if (t === q) return 100;
  if (t.includes(q)) return t.startsWith(q) ? 90 : 70;
  let qIdx = 0, score = 0, lastMatchIdx = -2, consecutiveBonus = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 10;
      if (i === lastMatchIdx + 1) consecutiveBonus += 5;
      lastMatchIdx = i;
      qIdx++;
    }
  }
  return qIdx === q.length ? score + consecutiveBonus : 0;
}

const categoryLabels = {
  screen: '画面', component: 'コンポーネント', action: 'アクション',
  table: 'テーブル', test: 'テスト', db: 'DB'
};

const categoryColors = {
  screen: 'bg-blue-100 text-blue-700',
  component: 'bg-green-100 text-green-700',
  action: 'bg-amber-100 text-amber-700',
  table: 'bg-purple-100 text-purple-700',
  test: 'bg-cyan-100 text-cyan-700',
  db: 'bg-rose-100 text-rose-700',
};

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<div class="px-4 py-8 text-center text-gray-400 text-sm">結果なし</div>';
    return;
  }

  container.innerHTML = results.map((item, i) => `
    <a href="${item.path}"
       class="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors search-result-item ${i === selectedIndex ? 'bg-indigo-50' : ''}"
       data-index="${i}">
      <span class="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${categoryColors[item.category] || 'bg-gray-100 text-gray-600'}">
        ${categoryLabels[item.category] || item.category}
      </span>
      <div class="min-w-0">
        <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(item.title)}</div>
        <div class="text-xs text-gray-500 truncate">${escapeHtml(item.description)}</div>
      </div>
    </a>
  `).join('');
}

function updateSelectedResult() {
  const items = document.querySelectorAll('.search-result-item');
  items.forEach((el, i) => {
    if (i === selectedIndex) {
      el.classList.add('bg-indigo-50');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('bg-indigo-50');
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// === キーボードショートカット ===

document.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
});

// === ページ初期化 ===

document.addEventListener('DOMContentLoaded', function () {
  // サイドバーの現在ページをアクティブ表示
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('aside a[href]').forEach(function (el) {
    const href = el.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      el.classList.add('bg-indigo-50', 'text-indigo-700', 'font-medium');
    }
  });
});
