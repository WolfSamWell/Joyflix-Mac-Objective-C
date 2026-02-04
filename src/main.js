// Joyflix Tauri - 主逻辑

const { invoke } = window.__TAURI__.core;

// 内置站点列表
const BUILTIN_SITES = [
  { name: '蛋蛋兔', url: 'https://www.dandantu.cc/' },
  { name: '可可影视', url: 'https://www.keke1.app/' },
  { name: '北觅影视', url: 'https://v.luttt.com/' },
  { name: 'omofun动漫', url: 'https://www.omofun2.xyz/' },
  { name: '奈飞工厂', url: 'https://yanetflix.com/' },
  { name: '爱迪影视', url: 'https://adys.tv/' },
  { name: 'GYING', url: 'https://www.gying.si' },
  { name: 'CCTV', url: 'https://tv.cctv.com/live/' },
  { name: '直播', url: 'https://live.wxhbts.com/' },
  { name: '短剧', url: 'https://www.jinlidj.com/' }
];

// 广告域名黑名单
const BLOCKED_DOMAINS = [
  'ynjczy.net', 'ylbdtg.com', '662820.com',
  'api.vparse.org', 'hyysvip.duapp.com', 'f.qcwzx.net.cn',
  'adx.dlads.cn', 'dlads.cn', 'wuo.8h2x.com', 'strip.alicdn.com'
];

let config = { custom_sites: [], last_url: '', auto_open: false };

// DOM 元素
const webview = document.getElementById('main-webview');
const urlInput = document.getElementById('url-input');
const sitesPanel = document.getElementById('sites-panel');
const historyPanel = document.getElementById('history-panel');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  initEventListeners();
  renderBuiltinSites();
  renderCustomSites();

  // 加载上次访问的站点
  if (config.last_url) {
    navigateTo(config.last_url);
  }
});

// 加载配置
async function loadConfig() {
  try {
    config = await invoke('load_config');
  } catch (e) {
    console.error('加载配置失败:', e);
  }
}

// 保存配置
async function saveConfig() {
  try {
    await invoke('save_config', { config });
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

// 导航到URL
function navigateTo(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 检查广告拦截
  for (const domain of BLOCKED_DOMAINS) {
    if (url.includes(domain)) {
      console.log('已拦截广告:', url);
      return;
    }
  }

  webview.src = url;
  urlInput.value = url;
  config.last_url = url;
  saveConfig();
}

// 初始化事件监听
function initEventListeners() {
  // 导航按钮
  document.getElementById('btn-back').onclick = () => webview.goBack();
  document.getElementById('btn-forward').onclick = () => webview.goForward();
  document.getElementById('btn-refresh').onclick = () => webview.reload();
  document.getElementById('btn-home').onclick = () => navigateTo(BUILTIN_SITES[0].url);

  // URL 输入
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateTo(urlInput.value);
    }
  });

  // 面板按钮
  document.getElementById('btn-sites').onclick = () => togglePanel(sitesPanel);
  document.getElementById('btn-history').onclick = () => {
    renderHistoryList();
    togglePanel(historyPanel);
  };

  // 关闭按钮
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.panel').classList.add('hidden');
    };
  });

  // 添加站点
  document.getElementById('btn-add-site').onclick = addCustomSite;

  // 清除历史
  document.getElementById('btn-clear-history').onclick = clearHistory;

  // WebView 事件
  webview.addEventListener('did-navigate', (e) => {
    urlInput.value = e.url;
    addToHistory(document.title || e.url, e.url);
  });

  webview.addEventListener('did-finish-load', () => {
    // 注入自定义脚本
    injectScripts();
  });
}

// 切换面板显示
function togglePanel(panel) {
  const isHidden = panel.classList.contains('hidden');
  // 先隐藏所有面板
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  // 切换当前面板
  if (isHidden) {
    panel.classList.remove('hidden');
  }
}

// 渲染内置站点
function renderBuiltinSites() {
  const container = document.getElementById('builtin-sites');
  container.innerHTML = BUILTIN_SITES.map(site =>
    `<button class="site-btn" data-url="${site.url}">${site.name}</button>`
  ).join('');

  container.querySelectorAll('.site-btn').forEach(btn => {
    btn.onclick = () => {
      navigateTo(btn.dataset.url);
      sitesPanel.classList.add('hidden');
    };
  });
}

// 渲染自定义站点
function renderCustomSites() {
  const container = document.getElementById('custom-sites');
  if (config.custom_sites.length === 0) {
    container.innerHTML = '<p style="color:#888;">暂无自定义站点</p>';
    return;
  }

  container.innerHTML = config.custom_sites.map((site, index) =>
    `<button class="site-btn" data-url="${site.url}" data-index="${index}">
      ${site.name}
      <span class="delete-site" data-index="${index}">×</span>
    </button>`
  ).join('');

  container.querySelectorAll('.site-btn').forEach(btn => {
    btn.onclick = (e) => {
      if (e.target.classList.contains('delete-site')) {
        deleteCustomSite(parseInt(e.target.dataset.index));
      } else {
        navigateTo(btn.dataset.url);
        sitesPanel.classList.add('hidden');
      }
    };
  });
}

// 添加自定义站点
function addCustomSite() {
  const nameInput = document.getElementById('new-site-name');
  const urlInput = document.getElementById('new-site-url');

  const name = nameInput.value.trim();
  let url = urlInput.value.trim();

  if (!name || !url) {
    alert('请输入站点名称和URL');
    return;
  }

  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  config.custom_sites.push({ name, url });
  saveConfig();
  renderCustomSites();

  nameInput.value = '';
  urlInput.value = '';
}

// 删除自定义站点
function deleteCustomSite(index) {
  config.custom_sites.splice(index, 1);
  saveConfig();
  renderCustomSites();
}

// 注入自定义脚本
function injectScripts() {
  const injectCode = getInjectScript();
  webview.executeJavaScript(injectCode).catch(console.error);
}

// 导出给其他模块使用
window.JoyflixApp = {
  navigateTo,
  BUILTIN_SITES,
  config
};
