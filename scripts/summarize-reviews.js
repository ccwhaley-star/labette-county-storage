#!/usr/bin/env node
/**
 * Regenerates the AI summary card in data/reviews.json from the reviews that
 * file actually contains. Run weekly by .github/workflows/refresh-reviews.yml.
 *
 *   node scripts/summarize-reviews.js          # write the summary back
 *   node scripts/summarize-reviews.js --dry    # print it, change nothing
 *
 * Needs ANTHROPIC_API_KEY in the environment.
 *
 * Honesty rules baked in below, because this text is a marketing claim on a
 * live site: the model only sees the reviews in reviews.json, `basedOn` is set
 * to how many it actually read (never the 92 total), and it is told not to
 * invent specifics. If the wall is later fed by the Google API, basedOn grows
 * on its own.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const DATA = path.join(__dirname, '..', 'data', 'reviews.json');
const DRY = process.argv.includes('--dry');

const SYSTEM = `You summarize customer reviews for a self-storage facility's website.

You will be given the full text of every review the site has on file. Write exactly three short bullet points capturing the themes a prospective customer would care about.

Rules:
- Every bullet must be supported by the reviews you were given. Do not infer, extrapolate, or add plausible-sounding detail that is not there.
- Do not invent numbers, dates, prices, staff names, or amenities.
- Report what reviewers say, not marketing copy. "Reviewers mention X" framing is fine; hype is not.
- If a theme appears in only one review, do not describe it as frequent or common.
- If the reviews are too few or too repetitive to support three distinct themes, return fewer bullets rather than padding.
- One sentence each, under 25 words, plain language, no emoji.`;

const TOOL = {
  name: 'save_summary',
  description: 'Save the review summary bullets for display on the website.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      bullets: {
        type: 'array',
        description: 'One to three summary bullets, most prominent theme first.',
        items: { type: 'string' },
      },
    },
    required: ['bullets'],
    additionalProperties: false,
  },
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const reviews = data.reviews || [];
  if (!reviews.length) throw new Error('data/reviews.json has no reviews to summarize');

  const corpus = reviews
    .map((r, i) => `Review ${i + 1} (${r.rating} stars, ${r.relativeTime}):\n${r.text}`)
    .join('\n\n');

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'save_summary' },
    messages: [
      {
        role: 'user',
        content: `Here are all ${reviews.length} reviews on file for ${data.place.name}:\n\n${corpus}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`model refused: ${response.stop_details && response.stop_details.explanation}`);
  }

  const call = response.content.find((b) => b.type === 'tool_use');
  if (!call) throw new Error('model returned no save_summary call');

  const bullets = call.input.bullets.filter((b) => typeof b === 'string' && b.trim());
  if (!bullets.length) throw new Error('model returned no bullets');

  const summary = {
    generatedAt: new Date().toISOString().slice(0, 10),
    generatedBy: 'claude-opus-5',
    // Deliberately the number of reviews actually read, NOT data.reviewCount -
    // the card says "Based on N Google reviews" and that has to be true.
    basedOn: reviews.length,
    bullets,
  };

  if (DRY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  data.summary = summary;
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
  console.log(`summary updated from ${reviews.length} reviews:`);
  bullets.forEach((b) => console.log('  - ' + b));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
