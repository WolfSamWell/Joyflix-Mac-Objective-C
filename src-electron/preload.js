const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('__TAURI__', {
    core: {
        invoke: async (command, args = {}) => {
            switch (command) {
                case 'load_history':
                    return await ipcRenderer.invoke('load-history');
                case 'save_history':
                    return await ipcRenderer.invoke('save-history', args.history);
                case 'load_config':
                    return await ipcRenderer.invoke('load-config');
                case 'save_config':
                    return await ipcRenderer.invoke('save-config', args.config);
                case 'clear_history':
                    return await ipcRenderer.invoke('clear-history');
                case 'open_site':
                    return await ipcRenderer.invoke('open-site', args.url, args.title);
                case 'go_home':
                    return await ipcRenderer.invoke('go-home');
                case 'toggle_fullscreen':
                    return await ipcRenderer.invoke('toggle-fullscreen', args.enter);
                default:
                    console.warn('Unknown command:', command);
            }
        }
    }
});

// 兼容 Tauri 的 API 结构
contextBridge.exposeInMainWorld('__TAURI_INTERNALS__', {
    metadata: {
        currentWindow: {
            label: 'main'
        }
    }
});
