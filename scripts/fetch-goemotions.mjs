#!/usr/bin/env node

/**
 * Fetch GoEmotions — Download and preprocess Google's GoEmotions dataset
 *
 * Downloads the GoEmotions dataset from GitHub, maps the 27 emotion
 * labels to Plutchik's 8 basic emotions, and outputs a fixture file
 * ready for batch scoring.
 *
 * Usage:
 *   node scripts/validation/fetch-goemotions.mjs [options]
 *
 * Options:
 *   --sample <n>     Number of texts to sample (default: 500)
 *   --seed <n>       Random seed for reproducible sampling (default: 42)
 *   --output <path>  Output fixture path (default: fixtures/goemotions.json)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

// ─── GoEmotions 27 → Plutchik 8 mapping ───

const GOEMOTIONS_LABELS = [
  'admiration', 'amusement', 'anger', 'annoyance', 'approval',
  'caring', 'confusion', 'curiosity', 'desire', 'disappointment',
  'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear',
  'gratitude', 'grief', 'joy', 'love', 'nervousness',
  'optimism', 'pride', 'realization', 'relief', 'remorse',
  'sadness', 'surprise', 'neutral',
];

const GOEMOTIONS_TO_PLUTCHIK = {
  // Joy cluster
  amusement: 'joy',
  excitement: 'joy',
  joy: 'joy',
  love: 'joy',
  pride: 'joy',
  relief: 'joy',

  // Trust cluster
  admiration: 'trust',
  approval: 'trust',
  caring: 'trust',
  gratitude: 'trust',

  // Fear cluster
  fear: 'fear',
  nervousness: 'fear',

  // Surprise cluster
  surprise: 'surprise',
  realization: 'surprise',
  confusion: 'surprise',

  // Sadness cluster
  sadness: 'sadness',
  grief: 'sadness',
  disappointment: 'sadness',
  remorse: 'sadness',
  embarrassment: 'sadness',

  // Disgust cluster
  disgust: 'disgust',
  disapproval: 'disgust',

  // Anger cluster
  anger: 'anger',
  annoyance: 'anger',

  // Anticipation cluster
  curiosity: 'anticipation',
  desire: 'anticipation',
  optimism: 'anticipation',

  // Skip
  neutral: null,
};

// ─── Seeded random ───

function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function shuffle(arr, rng) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Parse CLI args ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    sample: 500,
    seed: 42,
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sample': opts.sample = parseInt(args[++i]); break;
      case '--seed': opts.seed = parseInt(args[++i]); break;
      case '--output': opts.output = args[++i]; break;
    }
  }

  return opts;
}

// ─── Download and parse GoEmotions ───

async function fetchGoEmotions() {
  const baseUrl = 'https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data';

  console.log('Downloading GoEmotions dataset from GitHub...');

  const files = ['train.tsv', 'dev.tsv', 'test.tsv'];
  const allRows = [];

  for (const file of files) {
    const url = `${baseUrl}/${file}`;
    console.log(`  Fetching ${file}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n');

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const [textContent, labelIndices, id] = parts;

        // Parse label indices (comma-separated integers)
        const labels = labelIndices.split(',')
          .map(i => parseInt(i.trim()))
          .filter(i => !isNaN(i))
          .map(i => GOEMOTIONS_LABELS[i])
          .filter(Boolean);

        if (textContent && labels.length > 0) {
          allRows.push({
            text: textContent,
            goemotions_labels: labels,
            id,
          });
        }
      }
    }

    console.log(`    Parsed ${lines.length} lines`);
  }

  console.log(`Total rows: ${allRows.length}`);
  return allRows;
}

// ─── Map and filter ───

function mapToPlutchik(rows) {
  const mapped = [];

  for (const row of rows) {
    // Get the primary Plutchik label from the first GoEmotions label
    const primaryGoEmotion = row.goemotions_labels[0];
    const plutchikLabel = GOEMOTIONS_TO_PLUTCHIK[primaryGoEmotion];

    if (!plutchikLabel) continue; // Skip neutral

    // Get all Plutchik labels (for multi-label evaluation)
    const allPlutchikLabels = [...new Set(
      row.goemotions_labels
        .map(l => GOEMOTIONS_TO_PLUTCHIK[l])
        .filter(Boolean)
    )];

    mapped.push({
      text: row.text,
      goemotions_labels: row.goemotions_labels,
      plutchik_label: plutchikLabel,
      all_plutchik_labels: allPlutchikLabels,
      goemotions_id: row.id,
    });
  }

  return mapped;
}

// ─── Stratified sampling ───

function stratifiedSample(mapped, sampleSize, rng) {
  // Group by Plutchik label
  const groups = {};
  for (const item of mapped) {
    if (!groups[item.plutchik_label]) groups[item.plutchik_label] = [];
    groups[item.plutchik_label].push(item);
  }

  console.log('\nLabel distribution in full dataset:');
  for (const [label, items] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${label}: ${items.length}`);
  }

  // Sample proportionally from each group, with a minimum of 20 per group
  const perGroup = Math.max(20, Math.floor(sampleSize / Object.keys(groups).length));
  const sampled = [];

  for (const [label, items] of Object.entries(groups)) {
    const n = Math.min(perGroup, items.length);
    const shuffled = shuffle(items, rng);
    sampled.push(...shuffled.slice(0, n));
  }

  // If we need more, fill from remaining
  if (sampled.length < sampleSize) {
    const sampledIds = new Set(sampled.map(s => s.goemotions_id));
    const remaining = shuffle(mapped.filter(m => !sampledIds.has(m.goemotions_id)), rng);
    sampled.push(...remaining.slice(0, sampleSize - sampled.length));
  }

  return shuffle(sampled.slice(0, sampleSize), rng);
}

// ─── Main ───

async function main() {
  const opts = parseArgs();
  const rng = createRng(opts.seed);

  console.log('═══ GOEMOTIONS DATASET FETCHER ═══\n');

  // Download
  const rows = await fetchGoEmotions();

  // Map to Plutchik
  const mapped = mapToPlutchik(rows);
  console.log(`\nMapped to Plutchik: ${mapped.length} texts (${rows.length - mapped.length} neutral excluded)`);

  // Sample
  const sampled = stratifiedSample(mapped, opts.sample, rng);
  console.log(`Sampled: ${sampled.length} texts`);

  // Distribution in sample
  const sampleDist = {};
  for (const item of sampled) {
    sampleDist[item.plutchik_label] = (sampleDist[item.plutchik_label] || 0) + 1;
  }
  console.log('\nSample distribution:');
  for (const [label, count] of Object.entries(sampleDist).sort((a, b) => b - a)) {
    console.log(`  ${label}: ${count}`);
  }

  // Write fixture
  const outputPath = opts.output
    ? resolve(opts.output)
    : resolve(FIXTURES_DIR, 'goemotions.json');

  mkdirSync(dirname(outputPath), { recursive: true });

  const fixture = {
    meta: {
      version: '1.0',
      description: 'GoEmotions dataset (Google, 2020) mapped to Plutchik\'s 8 emotions',
      source: 'https://github.com/google-research/google-research/tree/master/goemotions',
      sample_size: sampled.length,
      seed: opts.seed,
      mapping: GOEMOTIONS_TO_PLUTCHIK,
      created: new Date().toISOString(),
    },
    texts: sampled,
  };

  writeFileSync(outputPath, JSON.stringify(fixture, null, 2));
  console.log(`\nFixture written to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
