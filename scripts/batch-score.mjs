#!/usr/bin/env node

/**
 * Batch Scorer — Score texts through the Vibe Engine API
 *
 * Reads texts from a JSON fixture file, scores each through the
 * 4-model Vibe Engine, and caches results to avoid re-scoring.
 *
 * Usage:
 *   node scripts/validation/batch-score.mjs [options]
 *
 * Options:
 *   --fixture <path>     Path to fixture JSON file (default: historical-events)
 *   --output <path>      Path for results JSON (default: auto-generated)
 *   --live               Force live API calls (ignore cache)
 *   --delay <ms>         Delay between API calls in ms (default: 1000)
 *   --limit <n>          Max texts to score (default: all)
 *   --base-url <url>     API base URL (default: http://localhost:3001)
 *
 * Requires: Dev server running on localhost:3001
 *   npm run dev -- --port 3001
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const RESULTS_DIR = resolve(__dirname, 'results');

// ─── Parse CLI args ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    fixture: 'historical-events',
    output: null,
    live: false,
    delay: 1000,
    limit: Infinity,
    baseUrl: 'http://localhost:3001',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fixture': opts.fixture = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
      case '--live': opts.live = true; break;
      case '--delay': opts.delay = parseInt(args[++i]); break;
      case '--limit': opts.limit = parseInt(args[++i]); break;
      case '--base-url': opts.baseUrl = args[++i]; break;
    }
  }

  return opts;
}

// ─── Score a single text ───

async function scoreText(text, baseUrl) {
  const start = Date.now();

  const response = await fetch(`${baseUrl}/api/vibe-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type: 'text' }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const result = await response.json();
  const latencyMs = Date.now() - start;

  return { ...result, latencyMs };
}

// ─── Load fixture file ───

function loadFixture(name) {
  const path = name.endsWith('.json')
    ? resolve(name)
    : resolve(FIXTURES_DIR, `${name}.json`);

  if (!existsSync(path)) {
    console.error(`Fixture not found: ${path}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─── Extract scorable texts from fixture ───

function extractTexts(fixture) {
  const texts = [];

  // Historical events format: { events: [{ headlines: [...] }] }
  if (fixture.events) {
    for (const event of fixture.events) {
      for (const headline of event.headlines) {
        texts.push({
          id: `${event.id}__${texts.length}`,
          text: headline,
          event_id: event.id,
          event_name: event.name,
          expected_dominant: event.expected_dominant,
          expected_secondary: event.expected_secondary,
          expected_signal_quality: event.expected_signal_quality,
        });
      }
    }
  }

  // GoEmotions format: { texts: [{ text, label, plutchik_label }] }
  if (fixture.texts) {
    for (const item of fixture.texts) {
      texts.push({
        id: `goemotions__${texts.length}`,
        text: item.text,
        label: item.label,
        plutchik_label: item.plutchik_label,
      });
    }
  }

  // Simple text list format: { items: [{ id, text, expected_dominant }] }
  if (fixture.items) {
    for (const item of fixture.items) {
      texts.push(item);
    }
  }

  return texts;
}

// ─── Load cached results ───

function loadCache(outputPath) {
  if (existsSync(outputPath)) {
    try {
      return JSON.parse(readFileSync(outputPath, 'utf-8'));
    } catch {
      return { results: [] };
    }
  }
  return { results: [] };
}

// ─── Calculate average scores across models ───

function averageScores(modelScores) {
  const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];
  const avg = {};
  const models = Object.keys(modelScores);

  for (const emotion of emotions) {
    const values = models.map(m => modelScores[m]?.[emotion]).filter(v => typeof v === 'number');
    avg[emotion] = values.length > 0
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;
  }

  return avg;
}

// ─── Main ───

async function main() {
  const opts = parseArgs();

  console.log('═══ VIBE ENGINE BATCH SCORER ═══\n');

  // Load fixture
  const fixture = loadFixture(opts.fixture);
  const texts = extractTexts(fixture);
  console.log(`Loaded ${texts.length} texts from fixture`);

  // Determine output path
  const fixtureName = basename(opts.fixture).replace('.json', '');
  const outputPath = opts.output
    ? resolve(opts.output)
    : resolve(RESULTS_DIR, `${fixtureName}-scored.json`);

  // Ensure results directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Load cache
  const cache = opts.live ? { results: [] } : loadCache(outputPath);
  const cachedIds = new Set(cache.results.map(r => r.id));
  console.log(`Cache: ${cachedIds.size} previously scored texts`);

  // Filter to unscored texts
  let toScore = texts.filter(t => !cachedIds.has(t.id));
  if (opts.limit < toScore.length) {
    toScore = toScore.slice(0, opts.limit);
  }

  console.log(`To score: ${toScore.length} texts`);
  console.log(`Estimated API calls: ${toScore.length * 4} (4 models per text)`);
  console.log(`Estimated cost: ~$${(toScore.length * 4 * 0.015).toFixed(2)}`);
  console.log(`Estimated time: ~${Math.ceil(toScore.length * (opts.delay + 3000) / 60000)} minutes\n`);

  if (toScore.length === 0) {
    console.log('Nothing to score. Use --live to re-score all texts.');
    return;
  }

  // Check if server is running
  try {
    await fetch(`${opts.baseUrl}`);
  } catch {
    console.error(`\nServer not reachable at ${opts.baseUrl}`);
    console.error('Start the dev server first: npm run dev -- --port 3001');
    process.exit(1);
  }

  // Score each text
  const results = opts.live ? [] : [...cache.results];
  let scored = 0;
  let failed = 0;

  for (const item of toScore) {
    scored++;
    const progress = `[${scored}/${toScore.length}]`;

    try {
      const result = await scoreText(item.text, opts.baseUrl);

      const entry = {
        ...item,
        scored_at: new Date().toISOString(),
        latencyMs: result.latencyMs,
        scores: result.scores,
        divergence: result.divergence,
        consensus: result.consensus,
        dominant_emotion: result.dominant_emotion,
        signal_quality: result.signal_quality,
        average_scores: averageScores(result.scores),
      };

      results.push(entry);

      // Determine if dominant matches expected
      const match = item.expected_dominant
        ? (Array.isArray(item.expected_dominant)
            ? item.expected_dominant.includes(result.dominant_emotion)
            : item.expected_dominant === result.dominant_emotion)
        : null;

      const matchStr = match === null ? '' : match ? ' ✓' : ` ✗ (got: ${result.dominant_emotion})`;

      console.log(
        `${progress} ${item.text.slice(0, 60)}... → ${result.dominant_emotion} (${result.signal_quality}, ${result.latencyMs}ms)${matchStr}`
      );

      // Save after each scoring (crash recovery)
      const output = {
        meta: {
          fixture: opts.fixture,
          scored_at: new Date().toISOString(),
          total_texts: texts.length,
          scored_count: results.length,
          base_url: opts.baseUrl,
        },
        results,
      };
      writeFileSync(outputPath, JSON.stringify(output, null, 2));

    } catch (err) {
      failed++;
      console.error(`${progress} FAILED: ${item.text.slice(0, 40)}... — ${err.message}`);
    }

    // Rate limiting
    if (scored < toScore.length) {
      await new Promise(r => setTimeout(r, opts.delay));
    }
  }

  console.log(`\n═══ SCORING COMPLETE ═══`);
  console.log(`Scored: ${scored - failed}/${scored}`);
  console.log(`Failed: ${failed}`);
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
