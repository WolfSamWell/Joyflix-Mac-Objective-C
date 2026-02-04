// Joyflix - 网站监控

// 检测网站状态
async function checkWebsiteStatus(url) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      url,
      status: 'online',
      responseTime,
      httpStatus: response.status || 200
    };
  } catch (error) {
    return {
      url,
      status: error.name === 'AbortError' ? 'timeout' : 'error',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

// 批量检测所有站点
async function checkAllSites(sites) {
  const results = await Promise.all(
    sites.map(site => checkWebsiteStatus(site.url))
  );

  return sites.map((site, index) => ({
    ...site,
    ...results[index]
  }));
}

// 获取最快的站点
async function getFastestSite(sites) {
  const results = await checkAllSites(sites);

  const onlineSites = results.filter(s => s.status === 'online');

  if (onlineSites.length === 0) {
    return null;
  }

  // 按响应时间排序
  onlineSites.sort((a, b) => a.responseTime - b.responseTime);

  return onlineSites[0];
}

// 导出
window.checkWebsiteStatus = checkWebsiteStatus;
window.checkAllSites = checkAllSites;
window.getFastestSite = getFastestSite;
