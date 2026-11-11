// Headless screenshots of the stage.
// Usage: node tools/shot.mjs <outDir> [t=24,...] [tpl=knot] [file=path] [three=1] [frames=60 step=0.08] [res=1] [key=value ...]
// Needs playwright-core; if it is not installed here, point PLAYWRIGHT_FROM at a folder whose node_modules has it.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(process.env.PLAYWRIGHT_FROM ? pathToFileURL(join(process.env.PLAYWRIGHT_FROM, 'x.js')) : import.meta.url);
const { chromium } = require('playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const [outDir, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.split('=')));
const times = (opt.t || '24').split(',').map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', e => console.log('page error:', e.message));
await page.goto(pathToFileURL(join(here, '..', 'index.html')).href + (opt.hash ? '#' + rest.find(a => a.startsWith('hash=')).slice(5) : ''));
await page.waitForFunction(() => window.GB);
await page.evaluate(() => window.GB.pause(true));
const set = {};
for (const k of ['density', 'glow', 'palette', 'bg', 'tol', 'format', 'res', 'charset', 'custom', 'strokes', 'shimmer', 'sat', 'contrast', 'scan', 'grain', 'fringe', 'mood', 'variation']) if (k in opt) set[k] = isNaN(+opt[k]) ? opt[k] : +opt[k];
for (const k of ['invert', 'intro', 'camera', 'hud', 'three', 'spin', 'paper', 'outline', 'showMask', 'alpha', 'lift']) if (k in opt) set[k] = opt[k] === '1';
if (!('res' in set)) set.res = 1;
// any other setting: p.key=value (numbers and true/false are converted)
for (const a of rest) if (a.startsWith('p.')) { const i = a.indexOf('='), v = a.slice(i + 1); set[a.slice(2, i)] = v === 'true' ? true : v === 'false' ? false : v !== '' && !isNaN(+v) ? +v : v; }
await page.evaluate(s => { Object.assign(window.GB.P, s); window.GB.stage(); }, set);
if (opt.tpl) await page.evaluate(k => window.GB.template(k), opt.tpl);
if (opt.file) {
  const bytes = readFileSync(opt.file).toString('base64');
  await page.evaluate(async ({ bytes, name }) => {
    const bin = atob(bytes), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const type = /\.gif$/i.test(name) ? 'image/gif' : /\.png$/i.test(name) ? 'image/png' : 'image/jpeg';
    window.GB.setSource(await window.GB.loadFile(new File([u], name, { type })));
  }, { bytes, name: basename(opt.file) });
}
if (opt.text) await page.evaluate(t => window.GB.text(t), opt.text.replace(/_/g, ' '));
if (opt.depth) {
  const bytes = readFileSync(opt.depth).toString('base64');
  await page.evaluate(async b => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); window.GB.depth(await createImageBitmap(new Blob([u]))); }, bytes);
}
if (opt.ai) {
  // runs the on-device depth model (needs network for the first download) and saves the depth picture
  const t0 = Date.now(), url = await page.evaluate(() => window.GB.ai());
  writeFileSync(join(outDir, `${opt.tag || 'ai'}_depth.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('ai depth', (Date.now() - t0) + ' ms');
}
if (opt.look) await page.evaluate(k => window.GB.look(k), opt.look);
await page.evaluate(() => window.GB.sync());
if (opt.zoom) await page.evaluate(z => { window.GB.orbit.zoom = z; }, +opt.zoom);
if (opt.yaw) await page.evaluate(y => { window.GB.orbit.yaw = y; }, +opt.yaw);
if ('three' in opt) await page.evaluate(() => window.GB.apply(true));
const tag = opt.tag || opt.tpl || (opt.file ? basename(opt.file).replace(/\W+/g, '_') : 'iris');
for (const t of times) {
  const t0 = Date.now();
  const url = await page.evaluate(tt => { window.GB.seek(tt); return window.GB.shot(); }, t);
  const out = join(outDir, `${tag}_${String(t).padStart(4, '0')}.png`);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(out, (Date.now() - t0) + ' ms');
}
if (opt.frames) {
  const step = +(opt.step || 0.08);
  for (let i = 0; i < +opt.frames; i++) {
    const url = await page.evaluate(dt => window.GB.step(dt), step);
    writeFileSync(join(outDir, `${tag}_f${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
if (opt.gif) {
  // gif=4 [gsize=640] [gfps=20] [from=start]
  const t0 = Date.now(), b64 = await page.evaluate(o => window.GB.gif(o), { secs: +opt.gif, size: +(opt.gsize || 640), fps: +(opt.gfps || 20), from: opt.from || 'now', fuzz: opt.fuzz === undefined ? undefined : +opt.fuzz, dither: opt.dither === undefined ? undefined : +opt.dither });
  writeFileSync(join(outDir, `${tag}.gif`), Buffer.from(b64, 'base64'));
  console.log('gif', (b64.length * 0.75 / 1048576).toFixed(2) + ' MB', (Date.now() - t0) + ' ms');
}
if (opt.video) {
  // video=4 [vsize=720] [vfps=30] [from=now] [sound=0] [codec=vp9]: frame-by-frame MP4 (needs network once for the muxer script)
  const t0 = Date.now(), out = await page.evaluate(o => window.GB.video(o), { secs: +opt.video, size: +(opt.vsize || 720), fps: +(opt.vfps || 30), from: opt.from || 'start', sound: opt.sound !== '0', codec: opt.codec });
  const cut = out.indexOf('|');
  if (cut < 0) console.log('video: no encoder in this browser');
  else { writeFileSync(join(outDir, `${tag}.mp4`), Buffer.from(out.slice(cut + 1), 'base64')); console.log('video', out.slice(0, cut), ((out.length - cut) * 0.75 / 1048576).toFixed(2) + ' MB', (Date.now() - t0) + ' ms'); }
}
if (opt.link) console.log('link:', await page.evaluate(() => window.GB.link()));
if (opt.wav) {
  // offline render of the soundtrack for this source, for level and spectrum checks
  const b64 = await page.evaluate(async sec => {
    const blob = await window.GB.music.render(sec), u = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
    return window.GB.score() + '|' + btoa(s);
  }, +opt.wav);
  const cut = b64.indexOf('|');
  writeFileSync(join(outDir, `${tag}.wav`), Buffer.from(b64.slice(cut + 1), 'base64'));
  console.log('score:', b64.slice(0, cut));
}
if (opt.tab) await page.click(`.tabs button[data-tab="${opt.tab}"]`);
if (opt.ui) await page.screenshot({ path: join(outDir, `${tag}_ui.png`) });
await browser.close();
