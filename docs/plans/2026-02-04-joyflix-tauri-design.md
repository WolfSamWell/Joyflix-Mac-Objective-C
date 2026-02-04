# Joyflix Tauri 设计文档

## 概述

将 Joyflix Mac Objective-C 项目改造为 Windows 版本，使用 Tauri 框架。

**目标：**
- 支持 Windows 10/11
- 保持核心功能：WebView 浏览器、历史记录、网站监控
- 解决 Cloudflare 验证问题
- 包体积小（~10MB）

---

## 1. 整体架构

```
Joyflix_Tauri/
├── src-tauri/              # Rust 后端（精简）
│   ├── src/
│   │   ├── main.rs         # 主入口
│   │   ├── commands.rs     # Tauri 命令
│   │   └── menu.rs         # 系统菜单
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── src/                    # 前端（主要逻辑）
│   ├── index.html          # 主页面
│   ├── main.js             # 核心逻辑
│   ├── styles.css          # 样式
│   └── utils/
│       ├── history.js      # 历史记录管理
│       ├── monitor.js      # 网站监控
│       └── inject.js       # JS 注入脚本
├── package.json
└── README.md
```

**设计原则：**
- Rust 端只处理：窗口管理、文件读写、系统 API
- JavaScript 端处理：UI 逻辑、历史记录、网站监控
- Rust 代码保持最少，便于学习

---

## 2. 核心功能模块

### 2.1 WebView 浏览器（核心）
- 主窗口加载视频网站
- 设置 customUserAgent 为 Chrome UA（解决 Cloudflare 问题）
- 支持前进/后退/刷新
- 注入自定义 JS（隐藏滚动条、红色全屏按钮）

### 2.2 历史记录
- 存储在本地 JSON 文件
- 记录访问的页面标题和 URL
- 最多保存 50 条
- 使用 Tauri 的 fs API 读写文件
- 存储位置：`%APPDATA%/Joyflix/history.json`

### 2.3 网站监控
- 内置视频站点列表
- 前端 fetch 检测网站状态
- 检测响应时间和在线状态
- 自动打开最快的站点（可选）

### 2.4 系统菜单
- Rust 端创建原生菜单
- 内置站点切换
- 用户自定义站点
- 工具菜单（清除缓存、历史记录等）

---

## 3. 数据流

```
┌─────────────────────────────────────────────────────┐
│                    Tauri 窗口                        │
│  ┌───────────────────────────────────────────────┐  │
│  │              WebView (视频网站)                │  │
│  │  - 加载 https://missav.ws 等                  │  │
│  │  - 注入 inject.js (红色按钮、隐藏滚动条)       │  │
│  └───────────────────────────────────────────────┘  │
│                        ↕ invoke                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              Rust 后端                         │  │
│  │  - 文件读写 (历史记录、配置)                   │  │
│  │  - 系统菜单                                    │  │
│  │  - 窗口控制                                    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 4. 文件存储

```
%APPDATA%/Joyflix/
├── history.json      # 观影历史
├── config.json       # 用户配置
│   ├── customSites   # 自定义站点列表
│   ├── lastUrl       # 上次访问的 URL
│   └── autoOpen      # 是否自动打开最快站点
└── monitor.json      # 网站监控数据
```

---

## 5. Rust ↔ JS 通信

```javascript
// JS 调用 Rust
import { invoke } from '@tauri-apps/api';
await invoke('save_history', { data: historyArray });
const history = await invoke('load_history');
```

```rust
// Rust 定义命令
#[tauri::command]
fn save_history(data: Vec<HistoryItem>) -> Result<(), String> { ... }

#[tauri::command]
fn load_history() -> Result<Vec<HistoryItem>, String> { ... }
```

---

## 6. Cloudflare 兼容性

### User-Agent 配置
```json
// tauri.conf.json
{
  "tauri": {
    "windows": [{
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }]
  }
}
```

### JS 注入脚本
```javascript
// inject.js - 页面加载后注入
(function() {
  // 1. 隐藏滚动条
  const style = document.createElement('style');
  style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
  document.head.appendChild(style);

  // 2. 红色全屏按钮（复用 Mac 版逻辑）
  // ...
})();
```

### 广告拦截
```javascript
const blockedDomains = [
  'ynjczy.net', 'ylbdtg.com', 'dlads.cn',
  '662820.com', 'api.vparse.org', 'adx.dlads.cn'
];
```

### 防止休眠
```rust
// Windows API 防止系统休眠
use windows::Win32::System::Power::SetThreadExecutionState;
```

---

## 7. 内置站点列表

| 名称 | URL |
|------|-----|
| 蛋蛋兔 | https://www.dandantu.cc/ |
| 可可影视 | https://www.keke1.app/ |
| 北觅影视 | https://v.luttt.com/ |
| omofun动漫 | https://www.omofun2.xyz/ |
| 奈飞工厂 | https://yanetflix.com/ |
| 爱迪影视 | https://adys.tv/ |
| GYING | https://www.gying.si |
| CCTV | https://tv.cctv.com/live/ |
| 直播 | https://live.wxhbts.com/ |
| 短剧 | https://www.jinlidj.com/ |

---

## 8. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML + CSS + JavaScript (原生) |
| 后端 | Rust + Tauri 2.0 |
| WebView | WebView2 (Windows 内置) |
| 构建 | npm + Cargo |
| 打包 | tauri build (.msi) |

---

## 9. 实现步骤

### 步骤 1：初始化项目
- `npm create tauri-app@latest Joyflix_Tauri`
- 配置 `tauri.conf.json`

### 步骤 2：核心 WebView 功能
- 配置 User-Agent
- 实现页面加载/导航
- JS 注入（滚动条隐藏、红色按钮）

### 步骤 3：历史记录模块
- Rust 端文件读写命令
- JS 端历史记录 UI

### 步骤 4：网站监控模块
- 内置站点列表
- 状态检测逻辑

### 步骤 5：系统菜单
- Rust 端创建菜单
- 站点切换、工具功能

### 步骤 6：打包发布
- 生成 Windows 安装包 (.msi)

---

## 10. 预计代码量

| 文件 | 行数 |
|------|------|
| Rust (main.rs, commands.rs, menu.rs) | ~150 行 |
| JavaScript (核心逻辑) | ~500 行 |
| HTML/CSS | ~200 行 |
| **总计** | **~850 行** |

---

## 11. 与 Mac 版对比

| 功能 | Mac 版 | Tauri Windows 版 |
|------|--------|------------------|
| WebView | WKWebView | WebView2 |
| 语言 | Objective-C | Rust + JavaScript |
| 包体积 | ~5MB | ~10MB |
| User-Agent | customUserAgent | tauri.conf.json |
| 文件存储 | ~/Library/Application Support | %APPDATA% |
| 防休眠 | IOKit | Windows API |
