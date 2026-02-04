// 尝试不同的方式获取 Electron API
console.log('=== Testing Electron Module Access ===');

console.log('1. Try require("electron"):');
try {
    const e1 = require('electron');
    console.log('   Type:', typeof e1);
    console.log('   Has app:', !!e1?.app);
} catch (e) {
    console.log('   Error:', e.message);
}

console.log('2. Try require("electron/main"):');
try {
    const e2 = require('electron/main');
    console.log('   Type:', typeof e2);
    console.log('   Has app:', !!e2?.app);
} catch (e) {
    console.log('   Error:', e.message);
}

console.log('3. Check global electron:');
console.log('   globalThis.electron:', globalThis.electron);

console.log('4. Check process.electronBinding:');
console.log('   process.electronBinding:', typeof process.electronBinding);

console.log('5. Check process._linkedBinding:');
if (typeof process._linkedBinding === 'function') {
    try {
        const browserWindow = process._linkedBinding('electron_browser_browser_window');
        console.log('   Got browserWindow binding:', !!browserWindow);
    } catch (e) {
        console.log('   Error:', e.message);
    }
}

console.log('\nDone testing.');
