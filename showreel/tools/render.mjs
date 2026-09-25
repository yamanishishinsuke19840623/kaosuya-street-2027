// 使い方: node tools/render.mjs http://reel.local/index.html <outDir> [fps=60] [times...]
// times を渡すとその秒数だけ静止画を書き出す（確認用）
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const [url, outDir, fpsArg, ...times] = process.argv.slice(2);
const fps = Number(fpsArg || 60);
fs.mkdirSync(outDir, { recursive: true });

const browser = await pw.chromium.launch({
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// ローカルファイルを仮想オリジンから配信（canvasを汚染させず、プロキシも通さない）
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.js': 'text/javascript' };
await page.route('http://reel.local/**', route => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'index.html';
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
  route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
});
// Google Fonts はプロキシのTLS再終端でChromiumが弾くため、curl（CA設定済み）で取得して渡す
import { execFileSync } from 'child_process';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, route => {
  try {
    const body = execFileSync('curl', ['-sSL', '-A', UA, route.request().url()], { maxBuffer: 64 << 20 });
    const u = route.request().url();
    route.fulfill({ status: 200, body, contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  } catch (e) { route.abort(); }
});
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'render=1', { waitUntil: 'networkidle' });
await page.evaluate(() => window.__ready);
const fontsOk = await page.evaluate(() => [
  document.fonts.check('900 50px "Noto Sans JP"', 'カオス'),
  document.fonts.check('50px Anton', 'A'),
  document.fonts.check('700 50px "JetBrains Mono"', 'A'),
]);
console.log('fonts', fontsOk);

const grab = async (t, file) => {
  const b64 = await page.evaluate(tt => { window.renderAt(tt); return document.getElementById('c').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
};

if (times.length) {
  for (const t of times) await grab(Number(t), path.join(outDir, `still_${t}.jpg`));
} else {
  const total = Math.round(15 * fps);
  for (let i = 0; i < total; i++) {
    await grab(i / fps, path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`));
    if (i % 60 === 0) console.log('frame', i, '/', total);
  }
}
await browser.close();
