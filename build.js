#!/usr/bin/env node
/**
 * Local build for the static Labette County Storage site.
 *
 * The site ships the MINIFIED files (css/styles.min.css, js/main.min.js),
 * but you edit the SOURCE files (css/styles.css, js/main.js). This script
 * keeps them in sync so a source edit never silently fails to reach
 * production (which is exactly what happened with main.min.js going stale
 * from July while main.js kept changing).
 *
 * What it does, in order:
 *   1. css/styles.css  -> css/styles.min.css   (clean-css, level 1, no URL rebasing)
 *   2. js/main.js      -> js/main.min.js       (terser, compress + mangle)
 *   3. Rewrites every  styles.min.css?v=…  and  main.min.js?v=…  reference in
 *      *.html and posts/*.html to a short content hash, so browsers only
 *      re-download an asset when its contents actually changed.
 *
 * Usage:   npm run build      (then commit the results)
 *
 * NOTE: this runs LOCALLY, before you commit. Netlify does NOT run it — the
 * minified files and hashed references are committed as-is, so the deploy
 * stays a plain no-build static site. Edit the source, run the build, commit.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CleanCSS = require('clean-css');
const { minify: terserMinify } = require('terser');

const ROOT = __dirname;
const CSS_SRC = path.join(ROOT, 'css', 'styles.css');
const CSS_OUT = path.join(ROOT, 'css', 'styles.min.css');
const JS_SRC = path.join(ROOT, 'js', 'main.js');
const JS_OUT = path.join(ROOT, 'js', 'main.min.js');

const shortHash = (buf) =>
  crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);

function htmlFiles() {
  const root = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(ROOT, f));
  const postsDir = path.join(ROOT, 'posts');
  const posts = fs.existsSync(postsDir)
    ? fs
        .readdirSync(postsDir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(postsDir, f))
    : [];
  return [...root, ...posts];
}

async function buildCss() {
  const src = fs.readFileSync(CSS_SRC, 'utf8');
  // level 1 = safe, whitespace/comment removal only — no rule reordering or
  // merging that could change cascade behaviour. rebase:false keeps the
  // relative url('../img/…') paths exactly as written.
  const out = new CleanCSS({ level: 1, rebase: false }).minify(src);
  if (out.errors.length) {
    throw new Error('clean-css errors:\n' + out.errors.join('\n'));
  }
  if (out.warnings.length) {
    console.warn('clean-css warnings:\n' + out.warnings.join('\n'));
  }
  fs.writeFileSync(CSS_OUT, out.styles);
  return { inBytes: src.length, outBytes: out.styles.length };
}

async function buildJs() {
  const src = fs.readFileSync(JS_SRC, 'utf8');
  const out = await terserMinify(src, { compress: true, mangle: true });
  if (!out.code) throw new Error('terser produced no output');
  fs.writeFileSync(JS_OUT, out.code);
  return { inBytes: src.length, outBytes: out.code.length };
}

function bustCacheRefs(cssV, jsV) {
  let changed = 0;
  for (const file of htmlFiles()) {
    const before = fs.readFileSync(file, 'utf8');
    const after = before
      .replace(/styles\.min\.css(\?v=[a-f0-9]+)?"/g, `styles.min.css?v=${cssV}"`)
      .replace(/main\.min\.js(\?v=[a-f0-9]+)?"/g, `main.min.js?v=${jsV}"`);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed++;
    }
  }
  return changed;
}

async function main() {
  const css = await buildCss();
  const js = await buildJs();

  const cssV = shortHash(fs.readFileSync(CSS_OUT));
  const jsV = shortHash(fs.readFileSync(JS_OUT));
  const changed = bustCacheRefs(cssV, jsV);

  console.log(
    [
      `css  ${css.inBytes} -> ${css.outBytes} bytes  (v=${cssV})`,
      `js   ${js.inBytes} -> ${js.outBytes} bytes  (v=${jsV})`,
      `refs ${changed} HTML file(s) updated`,
      '',
      'Now commit: css/styles.min.css js/main.min.js and the updated .html files.',
    ].join('\n')
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
