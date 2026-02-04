// Joyflix - 历史记录管理

const { invoke } = window.__TAURI__.core;

let historyList = [];

// 加载历史记录
async function loadHistory() {
  try {
    historyList = await invoke('load_history');
  } catch (e) {
    console.error('加载历史记录失败:', e);
    historyList = [];
  }
  return historyList;
}

// 保存历史记录
async function saveHistory() {
  try {
    await invoke('save_history', { data: historyList });
  } catch (e) {
    console.error('保存历史记录失败:', e);
  }
}

// 添加历史记录
async function addToHistory(name, url) {
  if (!url || url.includes('history_rendered') || url.includes('monitor_rendered')) {
    return;
  }

  // 如果 name 为空，使用 URL
  if (!name || name.trim() === '') {
    name = url;
  }

  const now = new Date();
  const time = now.toLocaleString('zh-CN');

  // 添加到列表开头
  historyList.unshift({ name, url, time });

  // 限制最多 50 条
  if (historyList.length > 50) {
    historyList = historyList.slice(0, 50);
  }

  await saveHistory();
}

// 清除历史记录
async function clearHistory() {
  try {
    await invoke('clear_history');
    historyList = [];
    renderHistoryList();
    alert('历史记录已清除');
  } catch (e) {
    console.error('清除历史记录失败:', e);
  }
}

// 渲染历史记录列表
async function renderHistoryList() {
  await loadHistory();

  const container = document.getElementById('history-list');

  if (historyList.length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">暂无观影记录</p>';
    return;
  }

  container.innerHTML = historyList.map((item, index) => `
    <div class="history-item" data-url="${item.url}" data-index="${index}">
      <span class="title">${escapeHtml(item.name)}</span>
      <span class="time">${item.time}</span>
    </div>
  `).join('');

  container.querySelectorAll('.history-item').forEach(item => {
    item.onclick = () => {
      window.JoyflixApp.navigateTo(item.dataset.url);
      document.getElementById('history-panel').classList.add('hidden');
    };
  });
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 导出
window.addToHistory = addToHistory;
window.clearHistory = clearHistory;
window.renderHistoryList = renderHistoryList;
window.loadHistory = loadHistory;
