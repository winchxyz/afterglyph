// Wraps app.html (the page body) into the standalone index.html that GitHub Pages serves.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(here, 'app.html'), 'utf8');
const reset = 'html{color-scheme:dark}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
const desc = 'Turn any image, GIF or short video into glowing glyph art you can spin in 3D. Runs entirely in the browser.';
const head = `<title>Afterglyph</title><meta name="description" content="${desc}"><meta property="og:title" content="Afterglyph"><meta property="og:description" content="${desc}"><meta property="og:image" content="https://winchxyz.github.io/afterglyph/docs/templates.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#05060c">`;
const page = `<!doctype html><html lang="en"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">${head}<style>${reset}</style></head><body>${body}</body></html>`;
writeFileSync(join(here, 'index.html'), page);
console.log('index.html', (page.length / 1024).toFixed(1) + ' KB');
