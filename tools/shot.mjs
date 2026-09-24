// Headless screenshots for checking the scene.
// usage: node tools/shot.mjs out_dir name=x,z,yaw,pitch[;js] ...
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [outDir, ...views] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: +(process.env.W ?? 1280), height: +(process.env.H ?? 760) });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));
for (const v of views) {
  const name = v.slice(0, v.indexOf('='));
  const rest = v.slice(v.indexOf('=') + 1);
  const semi = rest.indexOf(';');
  const pos = semi < 0 ? rest : rest.slice(0, semi);
  const js = semi < 0 ? null : rest.slice(semi + 1);
  await page.goto(`${process.env.BASE ?? "http://127.0.0.1:5391/"}index.html?shot&pos=${pos}${process.env.EXTRA ?? ""}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('enter').disabled || window.__failed, { timeout: 120000 }).catch(() => logs.push('timeout waiting for load'));
  if (js) await page.evaluate(js);
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: `${outDir}/${name}.png` });
  const info = await page.evaluate(() => {
    const r = window.__club?.renderer;
    const gl = r.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?' };
  });
  info.fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 90) requestAnimationFrame(f); else res(Math.round(90000 / (performance.now() - t0))); }; requestAnimationFrame(f); }));
  logs.push(`${name}: ${JSON.stringify(info)}`);
}
await browser.close();
console.log(logs.join('\n'));
