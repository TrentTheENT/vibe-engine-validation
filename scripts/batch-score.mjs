#!/usr/bin/env node

/**
 * Batch Scorer — Score texts through the VibeScore Tungsten API
 *
 * Reads texts from a JSON fixture file, scores each through the
 * multi-model Vibe Engine via /api/v1/score, and caches results.
 *
 * Usage:
 *   node scripts/batch-score.mjs [options]
 *
 * Options:
 *   --fixture <path>     Path to fixture JSON file (default: historical-events)
 *   --output <path>      Path for results JSON (default: auto-generated)
 *   --live               Force live API calls (ignore cache)
 *   --delay <ms>         Delay between API calls in ms (default: 1000)
 *   --limit <n>          Max texts to score (default: all)
 *   --base-url <url>     API base URL (default: http://localhost:3000)
 *   --api-key <key>      VibeScore API key (or set VIBESCORE_API_KEY env var)
 *
 * Requires:
 *   - A running VibeScore Tungsten instance (local or https://vibe-score.ai)
 *   - A valid API key with 'score' permission
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const FIXTURES_DIR = resolve(ROOT_DIR, 'fixtures');
const RESULTS_DIR = resolve(ROOT_DIR, 'results');

const EMOTIONS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];

// ─── Parse CLI args ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    fixture: 'historical-events',
    output: null,
    live: false,
    delay: 1000,
    limit: Infinity,
    baseUrl: 'http://localhost:3000',
    apiKey: process.env.VIBESCORE_API_KEY || null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fixture': opts.fixture = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
      case '--live': opts.live = true; break;
      case '--delay': opts.delay = parseInt(args[++i]); break;
      case '--limit': opts.limit = parseInt(args[++i]); break;
      case '--base-url': opts.baseUrl = args[++i]; break;
      case '--api-key': opts.apiKey = args[++i]; break;
    }
  }

  return opts;
}

// ─── Score a single text via /api/v1/score ───

async function scoreText(text, baseUrl, apiKey) {
  const start = Date.now();

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/api/v1/score`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      includePhysics: true,
      includeArchetype: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const result = await response.json();
  const latencyMs = Date.now() - start;

  // Map v1/score response to validation format
  return {
    latencyMs,
    // Consensus vector (the averaged emotional profile)
    average_scores: result.vector,
    // Dominant emotion
    dominant_emotion: result.emotion,
    // VibeScore (0-1000)
    vibe_score: result.score,
    // Consensus metrics
    consensus: result.consensus?.agreement ?? 1,
    divergence_index: result.consensus?.divergence ?? 0,
    models_used: result.consensus?.models ?? [],
    // Signal metrics
    signal: result.signal,
    // Signal quality derived from divergence
    signal_quality: deriveSignalQuality(result.consensus?.divergence ?? 0),
    // Physics (if included)
    physics: result.physics ?? null,
    // Archetype
    archetype: result.archetype ?? null,
    // Raw API response (for transparency)
    _raw: result,
  };
}

function deriveSignalQuality(divergence) {
  if (divergence < 0.15) return 'clear';
  if (divergence < 0.35) return 'mixed';
  return 'divergent';
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

  // Competitive tests format: { items: [{ id, text, expected_dominant }] }
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

// ─── Main ───

async function main() {
  const opts = parseArgs();

  console.log('═══ VIBE ENGINE BATCH SCORER ═══\n');
  console.log(`API:     ${opts.baseUrl}/api/v1/score`);
  console.log(`Auth:    ${opts.apiKey ? 'API key provided' : 'NO API KEY — set --api-key or VIBESCORE_API_KEY'}`);

  if (!opts.apiKey) {
    console.error('\nError: API key required. Use --api-key <key> or set VIBESCORE_API_KEY env var.');
    console.error('Get a key at https://vibe-score.ai/developers\n');
    process.exit(1);
  }

  // Load fixture
  const fixture = loadFixture(opts.fixture);
  const texts = extractTexts(fixture);
  console.log(`Fixture: ${opts.fixture} (${texts.length} texts)`);

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
  console.log(`Cache:   ${cachedIds.size} previously scored texts`);

  // Filter to unscored texts
  let toScore = texts.filter(t => !cachedIds.has(t.id));
  if (opts.limit < toScore.length) {
    toScore = toScore.slice(0, opts.limit);
  }

  console.log(`To score: ${toScore.length} texts\n`);

  if (toScore.length === 0) {
    console.log('Nothing to score. Use --live to re-score all texts.');
    return;
  }

  // Check if server is running
  try {
    await fetch(`${opts.baseUrl}`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`\nServer not reachable at ${opts.baseUrl}`);
    console.error('Start the Tungsten dev server or use --base-url https://vibe-score.ai');
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
      const result = await scoreText(item.text, opts.baseUrl, opts.apiKey);

      const entry = {
        ...item,
        scored_at: new Date().toISOString(),
        latencyMs: result.latencyMs,
        average_scores: result.average_scores,
        dominant_emotion: result.dominant_emotion,
        vibe_score: result.vibe_score,
        consensus: result.consensus,
        divergence_index: result.divergence_index,
        models_used: result.models_used,
        signal_quality: result.signal_quality,
        signal: result.signal,
        physics: result.physics,
        archetype: result.archetype,
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
          api_version: 'v1',
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
