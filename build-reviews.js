/**
 * Renders data/reviews.json into index.html.
 *
 * Two targets, both delimited so this is idempotent and safe to re-run:
 *   1. the visible review wall, between <!-- reviews:start --> / <!-- reviews:end -->
 *   2. the aggregateRating + review array inside the SelfStorage JSON-LD block
 *
 * The site ships the RENDERED HTML - nothing is fetched at runtime - so the
 * review text is in the initial payload for both crawlers and no-JS visitors.
 *
 * Called by build.js, so `npm run build` keeps the wall in sync. Also runnable
 * on its own: `node build-reviews.js`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'reviews.json');
const PAGE = path.join(ROOT, 'index.html');

const START = '<!-- reviews:start -->';
const END = '<!-- reviews:end -->';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const GOOGLE_G =
  '<svg class="review-avatar-badge" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>' +
  '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
  '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
  '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';

const VERIFIED =
  '<svg class="review-verified" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="#1a73e8" d="M12 1l2.4 2.1 3.2-.4 1.2 3 2.9 1.4-1 3.1 1 3.1-2.9 1.4-1.2 3-3.2-.4L12 23l-2.4-2.1-3.2.4-1.2-3L2.3 17l1-3.1-1-3.1 2.9-1.4 1.2-3 3.2.4z"/>' +
  '<path fill="#fff" d="M10.9 15.4l-3-3 1.3-1.3 1.7 1.7 4.1-4.1 1.3 1.3z"/></svg>';

const SPARKLE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' +
  '<path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/>' +
  '<path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>';

const GOOGLE_WORDMARK =
  '<svg class="review-google-mark" viewBox="0 0 74 24" role="img" aria-label="Google">' +
  '<text x="0" y="18" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="-0.5">' +
  '<tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan>' +
  '<tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan>' +
  '</text></svg>';

const FILLED = '★';
const EMPTY = '☆';
const stars = (n) => FILLED.repeat(n) + EMPTY.repeat(5 - n);
// JSON has no 5.0 - it round-trips to 5. Google always shows one decimal, so do we.
const fmtRating = (n) => Number(n).toFixed(1);

// Reviews display as first name + last initial ("Lois New" -> "Lois N."), so a
// customer's full name never sits on a public marketing page. Applied at render
// time, not in the data, so it also covers whatever the Google API returns.
function shortName(full) {
  const parts = String(full).trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  // First name + last initial, whatever sits in between.
  const last = parts[parts.length - 1];
  return parts[0] + ' ' + last.charAt(0).toUpperCase() + '.';
}

function summaryCard(d) {
  if (!d.summary || !Array.isArray(d.summary.bullets) || !d.summary.bullets.length) {
    return '';
  }
  const points = d.summary.bullets.map((b) => `            <li>${esc(b)}</li>`).join('\n');
  return `        <div class="review-card review-card-summary animate-in">
          <div class="review-summary-head">
            <div class="review-summary-icon">${SPARKLE}</div>
            <div class="review-meta">
              <div class="review-summary-title">AI-Generated Summary</div>
              <span class="review-date">Based on ${esc(d.summary.basedOn)} Google reviews</span>
            </div>
          </div>
          <div class="review-stars" aria-label="${fmtRating(d.rating)} out of 5">${stars(Math.round(d.rating))}</div>
          <ul class="review-summary-points">
${points}
          </ul>
        </div>`;
}

function reviewCard(r) {
  const avatar = r.photo
    ? `<img class="review-avatar-img" src="${esc(r.photo)}" alt="" width="44" height="44" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="review-avatar-initials" aria-hidden="true">${esc(r.initials)}</span>`;

  // Long reviews get clamped with a Read more toggle; short ones render plain so
  // we never show a button that would do nothing.
  const long = r.text.length > 190;
  const textCls = long ? 'review-text is-clamped' : 'review-text';
  const moreBtn = long
    ? '\n          <button type="button" class="review-more" aria-expanded="false">Read more</button>'
    : '';

  const reply = r.ownerReply
    ? `\n          <div class="review-reply">
            <span class="review-reply-label">Response from the owner</span>
            <p>${esc(r.ownerReply)}</p>
          </div>`
    : '';

  return `        <div class="review-card animate-in">
          <div class="review-card-head">
            <div class="review-avatar">${avatar}${GOOGLE_G}</div>
            <div class="review-meta">
              <div class="review-author"><span class="review-author-name">${esc(shortName(r.author))}</span>${VERIFIED}</div>
              <span class="review-date"><time datetime="${esc(r.date)}">${esc(r.relativeTime)}</time></span>
            </div>
          </div>
          <div class="review-stars" aria-label="${esc(r.rating)} out of 5 stars">${stars(r.rating)}</div>
          <p class="${textCls}">${esc(r.text)}</p>${moreBtn}${reply}
          ${GOOGLE_WORDMARK}
        </div>`;
}

function renderWall(d) {
  const blocks = [summaryCard(d), ...d.reviews.map(reviewCard)].filter(Boolean);
  const cards = blocks.join('\n');
  // Always lay the wall out as TWO balanced rows: with 4 cards that is 2
  // across, with 7 it is 4 then 3. Capped at 4 columns so a long review
  // list grows into a third row rather than squeezing the cards thinner.
  const cols = Math.min(4, Math.ceil(blocks.length / 2));
  return `      <div class="review-wall" style="--wall-cols: ${cols}">
${cards}
      </div>`;
}

/** Swap aggregateRating + review[] inside the SelfStorage JSON-LD block. */
function renderSchema(html, d) {
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g),
  ];
  const target = blocks.find((m) => m[1].includes('"aggregateRating"'));
  if (!target) throw new Error('no JSON-LD block with aggregateRating found');

  const ld = JSON.parse(target[1]);
  ld.aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: fmtRating(d.rating),
    reviewCount: String(d.reviewCount),
    bestRating: '5',
    worstRating: '1',
  };
  ld.review = d.reviews.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: shortName(r.author) },
    datePublished: r.date,
    reviewRating: { '@type': 'Rating', ratingValue: String(r.rating), bestRating: '5' },
    reviewBody: r.text,
  }));

  const body = JSON.stringify(ld, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n');
  return html.replace(target[0], `<script type="application/ld+json">\n  ${body}\n  </script>`);
}

function buildReviews() {
  if (!fs.existsSync(DATA)) return { skipped: true };

  const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const before = fs.readFileSync(PAGE, 'utf8');

  const s = before.indexOf(START);
  const e = before.indexOf(END);
  if (s === -1 || e === -1) {
    throw new Error(`index.html is missing the ${START} / ${END} markers`);
  }

  let html =
    before.slice(0, s + START.length) + '\n' + renderWall(d) + '\n      ' + before.slice(e);
  html = renderSchema(html, d);

  const changed = html !== before;
  if (changed) fs.writeFileSync(PAGE, html);
  return { count: d.reviews.length, changed };
}

module.exports = { buildReviews };

if (require.main === module) {
  const r = buildReviews();
  console.log(r.skipped ? 'no data/reviews.json - skipped' : `reviews: ${r.count} rendered`);
}
