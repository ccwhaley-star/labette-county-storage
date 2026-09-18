# Review wall

The review section on the homepage is generated, not hand-written.

```
data/reviews.json          <- single source of truth (committed)
      |
      +-- scripts/summarize-reviews.js   rewrites .summary (weekly, via Actions)
      |
      +-- build-reviews.js               renders -> index.html  (called by npm run build)
                                           - the visible .review-wall markup
                                           - aggregateRating + review[] in the JSON-LD
```

Nothing is fetched in the browser. The rendered HTML ships in the page, so the
review text is in the initial payload for crawlers and for no-JS visitors.

## Changing reviews

Edit `data/reviews.json`, then:

```bash
npm run build
```

Commit the JSON **and** the regenerated `index.html` / `.min` files. Editing the
markup between `<!-- reviews:start -->` and `<!-- reviews:end -->` by hand is
pointless — the next build overwrites it.

## Regenerating the AI summary

Runs automatically every Monday via `.github/workflows/refresh-reviews.yml`
(needs the `ANTHROPIC_API_KEY` repo secret). To run it by hand:

```bash
node scripts/summarize-reviews.js --dry
```

`--dry` prints the summary without writing. Drop it to save.

The card renders "Based on N Google reviews" where N is the number of reviews
the model actually read — `reviews.length`, **not** the 92-review total. If you
want that number to say 92, the wall has to actually contain 92 reviews. Don't
raise it by hand; it would be a false claim on a live page.

## Wiring the live Google feed

Currently `"source": "manual"` — the reviews were transcribed from the public
Google listing. Two ways to make it live, both of which only need to write
`data/reviews.json` and then run `npm run build`:

### Option A — Places API (fastest, capped at 5 reviews)

Google's Places API returns **at most 5 reviews** per place, with no pagination.
That is a hard cap, not a quota you can raise.

1. Create a Google Cloud project, enable **Places API (New)**, make an API key.
2. Restrict the key to the Places API.
3. Add a fetch step to the workflow ahead of the summarize step, calling
   `https://places.googleapis.com/v1/places/{PLACE_ID}` with field mask
   `rating,userRatingCount,reviews`.
4. Map each result into the `reviews[]` shape below and set
   `"source": "google-places"`.

Reviewer photos come back as `authorAttribution.photoUri` — put that in `photo`
and the renderer uses it instead of the initials avatar.

**Caching:** Google's terms don't allow storing Places content longer than 30
days. A weekly refresh is comfortably inside that; don't lower the cadence to
"once and forget".

### Option B — Business Profile API (all 92 reviews)

Returns every review, paginated 50 at a time, but only for listings you own,
and only after Google approves an access request (~2–4 weeks; every new Cloud
project starts at **zero quota** until then).

1. Apply via the Business Profile API access form.
2. Wait for quota to become non-zero — that is the signal you were approved.
3. OAuth as the account that owns the listing, page through
   `accounts/*/locations/*/reviews`, and write the same shape.
4. Set `"source": "google-business-profile"`.

## reviews[] shape

| field          | notes |
| -------------- | ----- |
| `author`       | display name |
| `initials`     | fallback avatar text, used when `photo` is null |
| `photo`        | absolute URL or `null` |
| `rating`       | integer 1–5 |
| `date`         | ISO `YYYY-MM-DD`, used for `<time datetime>` and `datePublished` |
| `relativeTime` | human string shown on the card, e.g. `6 months ago` |
| `text`         | review body; over 190 chars gets clamped with a Read more toggle |
| `ownerReply`   | owner's response, or `null` |

`rating` and `reviewCount` at the top level drive the aggregate badge and the
JSON-LD `aggregateRating`. Keep them matching the live Google numbers.
