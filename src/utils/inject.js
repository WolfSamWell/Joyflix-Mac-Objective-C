// Joyflix - JS 注入脚本

function getInjectScript() {
  return `
(function() {
  // 1. 隐藏滚动条
  (function hideScrollbars() {
    var style = document.getElementById('joyflix-hide-scrollbar');
    if (!style) {
      style = document.createElement('style');
      style.id = 'joyflix-hide-scrollbar';
      style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
      document.head.appendChild(style);
    }
  })();

  // 2. 红色全屏按钮
  (function createFullscreenButton() {
    if (document.querySelector('.joyflix-fullscreen-btn')) return;

    var btn = document.createElement('button');
    btn.className = 'joyflix-fullscreen-btn';
    btn.innerText = '+';
    btn.style.cssText = \`
      position: fixed;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      background: rgba(255,0,0,0.8);
      color: white;
      border: none;
      padding: 520px 3px;
      border-radius: 8px 0 0 0;
      cursor: pointer;
      font-size: 20px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s;
    \`;

    var autoHideTimer = null;

    function showBtn() {
      btn.style.opacity = '1';
      if (autoHideTimer) clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(function() {
        btn.style.opacity = '0';
      }, 1000);
    }

    btn.onmouseenter = showBtn;
    btn.onmouseleave = function() {
      if (autoHideTimer) clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(function() {
        btn.style.opacity = '0';
      }, 1000);
    };

    document.addEventListener('mousemove', function(e) {
      if (window.innerWidth - e.clientX <= 20) {
        showBtn();
      }
    });

    btn.onclick = function() {
      var iframes = Array.from(document.querySelectorAll('iframe'));
      if (iframes.length === 0) {
        alert('未找到iframe播放器');
        return;
      }

      // 找到最大的 iframe
      var maxIframe = iframes[0];
      var maxArea = 0;
      for (var i = 0; i < iframes.length; i++) {
        var rect = iframes[i].getBoundingClientRect();
        var area = rect.width * rect.height;
        if (area > maxArea) {
          maxArea = area;
          maxIframe = iframes[i];
        }
      }

      var target = maxIframe;

      if (!target._isFullscreen) {
        // 进入全屏
        target._originParent = target.parentElement;
        target._originNext = target.nextSibling;
        target._originStyle = {
          position: target.style.position,
          zIndex: target.style.zIndex,
          left: target.style.left,
          top: target.style.top,
          width: target.style.width,
          height: target.style.height,
          background: target.style.background
        };

        document.body.appendChild(target);
        target.style.position = 'fixed';
        target.style.zIndex = '2147483646';
        target.style.left = '0';
        target.style.top = '0';
        target.style.width = '100vw';
        target.style.height = '100vh';
        target.style.background = 'black';
        target._isFullscreen = true;
        window.scrollTo(0, 0);
        
        // 调用 Tauri 进入全屏并隐藏菜单栏
        if (window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('toggle_fullscreen', { enter: true });
        }
      } else {
        // 退出全屏
        if (target._originParent) {
          if (target._originNext && target._originNext.parentElement === target._originParent) {
            target._originParent.insertBefore(target, target._originNext);
          } else {
            target._originParent.appendChild(target);
          }
        }
        if (target._originStyle) {
          target.style.position = target._originStyle.position;
          target.style.zIndex = target._originStyle.zIndex;
          target.style.left = target._originStyle.left;
          target.style.top = target._originStyle.top;
          target.style.width = target._originStyle.width;
          target.style.height = target._originStyle.height;
          target.style.background = target._originStyle.background;
        }
        target._isFullscreen = false;
        
        // 调用 Tauri 退出全屏并显示菜单栏
        if (window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('toggle_fullscreen', { enter: false });
        }
      }
    };

    document.body.appendChild(btn);

    // ESC 退出全屏
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape') {
        var iframes = Array.from(document.querySelectorAll('iframe'));
        for (var i = 0; i < iframes.length; i++) {
          if (iframes[i]._isFullscreen) {
            btn.onclick();
            break;
          }
        }
      }
    });
  })();
})();
`;
}

// 导出
window.getInjectScript = getInjectScript;
