// 使い方:
//   node anime/tools/render.mjs <outDir> [fps=24] [times...]
//   times を渡すとその秒数だけ静止画を書き出す（確認用）
//   フレームと一緒に、アニメ側が登録した効果音のタイミングを <outDir>/cues.json に書き出す
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const [outDir, fpsArg, ...times] = process.argv.slice(2);
const fps = Number(fpsArg || 24);
fs.mkdirSync(outDir, { recursive: true });
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
// リポジトリ内のファイルは仮想オリジンから配信（canvas を汚さない）
await page.route('http://paper.local/**', route => {
  const f = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
  if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
  route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
});
// Google Fonts はプロキシのTLS再終端でChromiumが弾くため、curl（CA設定済み）で取得
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, route => {
  try {
    const u = route.request().url();
    const body = execFileSync('curl', ['-sSL', '-A', UA, u], { maxBuffer: 64 << 20 });
    route.fulfill({ status: 200, body, contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  } catch { route.abort(); }
});
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://paper.local/anime/index.html?render=1', { waitUntil: 'networkidle' });
await page.evaluate(() => window.__ready);
const dur = await page.evaluate(() => 19 * 4 * 60 / 96);
fs.writeFileSync(path.join(outDir, 'cues.json'), JSON.stringify(await page.evaluate(() => window.getCues()), null, 1));

const grab = async (t, file) => {
  const b64 = await page.evaluate(tt => { window.renderAt(tt); return document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1]; }, t);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
};
if (times.length) {
  for (const t of times) await grab(Number(t), path.join(outDir, `still_${t}.jpg`));
} else {
  const total = Math.round(dur * fps);
  for (let i = 0; i < total; i++) {
    await grab(i / fps, path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`));
    if (i % 120 === 0) console.log('frame', i, '/', total);
  }
}
await browser.close();
