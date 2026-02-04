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

let config = { custom_sites: [], last_url: '', auto_open: false };

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  renderBuiltinSites();
  renderCustomSites();
  initEventListeners();
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

// 打开站点 - 使用新窗口
async function openSite(name, url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    await invoke('open_site', { url, title: name });
    config.last_url = url;
    saveConfig();
  } catch (e) {
    console.error('打开站点失败:', e);
    alert('打开站点失败: ' + e);
  }
}

// 初始化事件监听
function initEventListeners() {
  // 添加站点
  document.getElementById('btn-add-site').onclick = addCustomSite;
}

// 渲染内置站点
function renderBuiltinSites() {
  const container = document.getElementById('builtin-sites');
  container.innerHTML = BUILTIN_SITES.map(site =>
    `<button class="site-btn" data-url="${site.url}" data-name="${site.name}">${site.name}</button>`
  ).join('');

  container.querySelectorAll('.site-btn').forEach(btn => {
    btn.onclick = () => openSite(btn.dataset.name, btn.dataset.url);
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
    `<button class="site-btn" data-url="${site.url}" data-name="${site.name}" data-index="${index}">
      ${site.name}
      <span class="delete-site" data-index="${index}">×</span>
    </button>`
  ).join('');

  container.querySelectorAll('.site-btn').forEach(btn => {
    btn.onclick = (e) => {
      if (e.target.classList.contains('delete-site')) {
        deleteCustomSite(parseInt(e.target.dataset.index));
      } else {
        openSite(btn.dataset.name, btn.dataset.url);
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
