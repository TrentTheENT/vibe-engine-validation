#!/usr/bin/env node

/**
 * Analyze Results — Compute validation metrics from scored results
 *
 * Reads scored results JSON and generates a comprehensive report
 * showing how well the Vibe Engine matches expected emotions.
 *
 * Usage:
 *   node scripts/analyze-results.mjs [options]
 *
 * Options:
 *   --results <path>     Path to scored results JSON (default: historical-events-scored)
 *   --format <fmt>       Output format: text, json, markdown (default: text)
 *   --output <path>      Write report to file (default: stdout)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const RESULTS_DIR = resolve(ROOT_DIR, 'results');

const EMOTIONS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];

// ─── Parse CLI args ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    results: 'historical-events-scored',
    format: 'text',
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--results': opts.results = args[++i]; break;
      case '--input': opts.results = args[++i]; break; // alias
      case '--format': opts.format = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
    }
  }

  return opts;
}

// ─── Statistics helpers ───

function mean(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function getDominant(scores) {
  let max = -1, dominant = '';
  for (const e of EMOTIONS) {
    if ((scores[e] || 0) > max) {
      max = scores[e];
      dominant = e;
    }
  }
  return { emotion: dominant, score: max };
}

function getTopN(scores, n = 3) {
  return EMOTIONS
    .map(e => ({ emotion: e, score: scores[e] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// ─── Get average scores from a result ───
// Handles both old format (scores.claude/gemini) and new format (average_scores or vector)

function getAvgScores(result) {
  // New format: average_scores is the consensus vector
  if (result.average_scores) return result.average_scores;

  // Legacy format: per-model scores that need averaging
  if (result.scores && typeof result.scores === 'object') {
    const models = Object.keys(result.scores);
    const avg = {};
    for (const e of EMOTIONS) {
      const values = models.map(m => result.scores[m]?.[e]).filter(v => typeof v === 'number');
      avg[e] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    }
    return avg;
  }

  return {};
}

// ─── Get dominant emotion from a result ───

function getResultDominant(result) {
  return result.dominant_emotion || getDominant(getAvgScores(result)).emotion;
}

// ─── Historical Events Analysis ───

function analyzeHistoricalEvents(results) {
  // Group by event
  const eventGroups = {};
  for (const r of results) {
    if (!r.event_id) continue;
    if (!eventGroups[r.event_id]) {
      eventGroups[r.event_id] = {
        event_id: r.event_id,
        event_name: r.event_name,
        expected_dominant: r.expected_dominant,
        expected_secondary: r.expected_secondary,
        expected_signal_quality: r.expected_signal_quality,
        headlines: [],
      };
    }
    eventGroups[r.event_id].headlines.push(r);
  }

  const events = Object.values(eventGroups);
  const eventResults = [];

  for (const event of events) {
    // Average the consensus vectors across all headlines for this event
    const avgVector = {};
    for (const e of EMOTIONS) {
      avgVector[e] = mean(event.headlines.map(h => getAvgScores(h)[e] || 0));
    }

    const dominant = getDominant(avgVector);
    const top3 = getTopN(avgVector, 3);
    const consensusScores = event.headlines.map(h =>
      typeof h.consensus === 'number' ? h.consensus : 0
    );
    const signalQualities = event.headlines.map(h => h.signal_quality).filter(Boolean);

    // Check dominant match
    const expectedDoms = Array.isArray(event.expected_dominant)
      ? event.expected_dominant
      : [event.expected_dominant];
    const dominantMatch = expectedDoms.includes(dominant.emotion);

    // Check secondary match (at least one expected secondary in top 3)
    const top3Emotions = top3.map(t => t.emotion);
    const secondaryMatch = event.expected_secondary
      ? event.expected_secondary.some(s => top3Emotions.includes(s))
      : null;

    // Signal quality distribution
    const sqDist = {};
    for (const sq of signalQualities) {
      sqDist[sq] = (sqDist[sq] || 0) + 1;
    }
    const mostCommonSQ = Object.entries(sqDist).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
    const signalQualityMatch = event.expected_signal_quality === mostCommonSQ;

    // Per-headline dominant match rate
    const headlineDomMatches = event.headlines.filter(h => {
      return expectedDoms.includes(getResultDominant(h));
    }).length;

    eventResults.push({
      event_id: event.event_id,
      event_name: event.event_name,
      headline_count: event.headlines.length,
      expected_dominant: event.expected_dominant,
      actual_dominant: dominant.emotion,
      dominant_score: dominant.score,
      dominant_match: dominantMatch,
      expected_secondary: event.expected_secondary,
      top3: top3,
      secondary_match: secondaryMatch,
      expected_signal_quality: event.expected_signal_quality,
      actual_signal_quality: mostCommonSQ,
      signal_quality_match: signalQualityMatch,
      signal_quality_distribution: sqDist,
      avg_consensus: mean(consensusScores),
      avg_latency_ms: mean(event.headlines.map(h => h.latencyMs || 0)),
      headline_dominant_match_rate: headlineDomMatches / event.headlines.length,
      avg_vector: avgVector,
    });
  }

  return eventResults;
}

// ─── GoEmotions Analysis ───

function analyzeGoEmotions(results) {
  const withLabels = results.filter(r => r.plutchik_label);
  if (!withLabels.length) return null;

  // Confusion matrix
  const confusionMatrix = {};
  for (const e of EMOTIONS) {
    confusionMatrix[e] = {};
    for (const f of EMOTIONS) {
      confusionMatrix[e][f] = 0;
    }
  }

  let correct = 0;
  for (const r of withLabels) {
    const predicted = getResultDominant(r);
    const actual = r.plutchik_label;
    if (confusionMatrix[actual]) {
      confusionMatrix[actual][predicted] = (confusionMatrix[actual][predicted] || 0) + 1;
    }
    if (predicted === actual) correct++;
  }

  // Per-emotion precision, recall, F1
  const metrics = {};
  for (const e of EMOTIONS) {
    const tp = confusionMatrix[e]?.[e] || 0;
    const fp = EMOTIONS.reduce((s, f) => s + (f !== e ? (confusionMatrix[f]?.[e] || 0) : 0), 0);
    const fn = EMOTIONS.reduce((s, f) => s + (f !== e ? (confusionMatrix[e]?.[f] || 0) : 0), 0);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    metrics[e] = { precision, recall, f1, tp, fp, fn };
  }

  const macroF1 = mean(EMOTIONS.map(e => metrics[e].f1));

  return {
    total: withLabels.length,
    accuracy: correct / withLabels.length,
    macroF1,
    perEmotion: metrics,
    confusionMatrix,
  };
}

// ─── Report Generation ───

function generateTextReport(eventResults, goEmotionsResults) {
  const lines = [];
  const hr = '═'.repeat(70);

  lines.push(hr);
  lines.push('  VIBE ENGINE VALIDATION REPORT');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push(hr);

  if (eventResults.length > 0) {
    lines.push('\n── HISTORICAL EVENTS ANALYSIS ──\n');

    const domMatches = eventResults.filter(e => e.dominant_match).length;
    const secMatches = eventResults.filter(e => e.secondary_match).length;
    const sqMatches = eventResults.filter(e => e.signal_quality_match).length;

    lines.push(`Events analyzed: ${eventResults.length}`);
    lines.push(`Dominant emotion match: ${domMatches}/${eventResults.length} (${(domMatches/eventResults.length*100).toFixed(0)}%) — target >=80%`);
    lines.push(`Secondary emotion match: ${secMatches}/${eventResults.length} (${(secMatches/eventResults.length*100).toFixed(0)}%) — target >=70%`);
    lines.push(`Signal quality match: ${sqMatches}/${eventResults.length} (${(sqMatches/eventResults.length*100).toFixed(0)}%)`);

    const passed = domMatches / eventResults.length >= 0.80;
    lines.push(`\nOVERALL: ${passed ? 'PASS' : 'FAIL'}\n`);

    // Per-event details
    lines.push('-'.repeat(70));
    for (const event of eventResults) {
      const dm = event.dominant_match ? 'Y' : 'N';
      const sm = event.secondary_match ? 'Y' : 'N';

      lines.push(`\n${event.event_name}`);
      lines.push(`  Expected dominant: ${Array.isArray(event.expected_dominant) ? event.expected_dominant.join('/') : event.expected_dominant}`);
      lines.push(`  Actual dominant:   ${event.actual_dominant} (${event.dominant_score.toFixed(3)}) ${dm}`);
      lines.push(`  Top 3 emotions:    ${event.top3.map(t => `${t.emotion}(${t.score.toFixed(3)})`).join(', ')}`);
      lines.push(`  Secondary match:   ${sm} (expected: ${event.expected_secondary?.join(', ')})`);
      lines.push(`  Signal quality:    ${event.actual_signal_quality} (expected: ${event.expected_signal_quality})`);
      lines.push(`  Per-headline match: ${(event.headline_dominant_match_rate * 100).toFixed(0)}%`);
    }

    // Divergence thesis check
    lines.push('\n\n── DIVERGENCE THESIS ──\n');
    const polarizing = eventResults.filter(e =>
      e.expected_signal_quality === 'divergent' || e.expected_signal_quality === 'mixed'
    );
    const clear = eventResults.filter(e => e.expected_signal_quality === 'clear');

    const polarizingConsensus = mean(polarizing.map(e => e.avg_consensus));
    const clearConsensus = mean(clear.map(e => e.avg_consensus));

    lines.push(`Clear events avg consensus:      ${clearConsensus.toFixed(3)} (n=${clear.length})`);
    lines.push(`Polarizing events avg consensus: ${polarizingConsensus.toFixed(3)} (n=${polarizing.length})`);
    lines.push(`Delta:                           ${(clearConsensus - polarizingConsensus).toFixed(3)}`);

    if (clearConsensus > polarizingConsensus) {
      lines.push(`\nDIVERGENCE THESIS: SUPPORTED`);
      lines.push(`  Polarizing events show lower consensus (more model disagreement)`);
      lines.push(`  than clear events — divergence tracks real-world ambiguity.`);
    } else {
      lines.push(`\nDIVERGENCE THESIS: NOT SUPPORTED`);
    }
  }

  if (goEmotionsResults) {
    lines.push('\n\n── GOEMOTIONS BENCHMARK ──\n');
    lines.push(`Total texts scored: ${goEmotionsResults.total}`);
    lines.push(`Accuracy: ${(goEmotionsResults.accuracy * 100).toFixed(1)}%`);
    lines.push(`Macro F1: ${goEmotionsResults.macroF1.toFixed(3)} — target >=0.50`);

    const passed = goEmotionsResults.macroF1 >= 0.50;
    lines.push(`\nOVERALL: ${passed ? 'PASS' : 'NEEDS REVIEW'}\n`);

    lines.push('Per-emotion metrics:');
    lines.push('  Emotion       Precision  Recall  F1     TP   FP   FN');
    lines.push('  ' + '-'.repeat(60));
    for (const e of EMOTIONS) {
      const m = goEmotionsResults.perEmotion[e];
      lines.push(
        `  ${e.padEnd(14)} ${m.precision.toFixed(3).padStart(9)} ${m.recall.toFixed(3).padStart(7)} ${m.f1.toFixed(3).padStart(6)} ${String(m.tp).padStart(5)} ${String(m.fp).padStart(5)} ${String(m.fn).padStart(5)}`
      );
    }
  }

  lines.push('\n' + hr);
  return lines.join('\n');
}

function generateMarkdownReport(eventResults, goEmotionsResults) {
  const lines = [];

  lines.push('# Vibe Engine Validation Report\n');
  lines.push(`Generated: ${new Date().toISOString()}\n`);

  if (eventResults.length > 0) {
    lines.push('## Historical Events Analysis\n');

    const domMatches = eventResults.filter(e => e.dominant_match).length;
    const secMatches = eventResults.filter(e => e.secondary_match).length;

    lines.push(`| Metric | Result | Target |`);
    lines.push(`|--------|--------|--------|`);
    lines.push(`| Dominant emotion match | ${domMatches}/${eventResults.length} (${(domMatches/eventResults.length*100).toFixed(0)}%) | >=80% |`);
    lines.push(`| Secondary emotion match | ${secMatches}/${eventResults.length} (${(secMatches/eventResults.length*100).toFixed(0)}%) | >=70% |`);
    lines.push('');

    lines.push('### Per-Event Results\n');
    lines.push('| Event | Expected | Actual | Match | Top 3 |');
    lines.push('|-------|----------|--------|-------|-------|');

    for (const event of eventResults) {
      const exp = Array.isArray(event.expected_dominant)
        ? event.expected_dominant.join('/')
        : event.expected_dominant;
      const match = event.dominant_match ? 'Y' : 'N';
      const top3 = event.top3.map(t => `${t.emotion}(${t.score.toFixed(2)})`).join(', ');
      lines.push(`| ${event.event_name} | ${exp} | ${event.actual_dominant} | ${match} | ${top3} |`);
    }
  }

  if (goEmotionsResults) {
    lines.push('\n## GoEmotions Benchmark\n');
    lines.push(`- Accuracy: **${(goEmotionsResults.accuracy * 100).toFixed(1)}%**`);
    lines.push(`- Macro F1: **${goEmotionsResults.macroF1.toFixed(3)}** (target >=0.50)\n`);
  }

  return lines.join('\n');
}

// ─── Main ───

async function main() {
  const opts = parseArgs();

  // Load results
  const resultsPath = opts.results.endsWith('.json')
    ? resolve(opts.results)
    : resolve(RESULTS_DIR, `${opts.results}.json`);

  const data = JSON.parse(readFileSync(resultsPath, 'utf-8'));
  const results = data.results;

  console.log(`Loaded ${results.length} scored results from ${resultsPath}\n`);

  // Analyze
  const eventResults = analyzeHistoricalEvents(results);
  const goEmotionsResults = analyzeGoEmotions(results);

  // Generate report
  let report;
  switch (opts.format) {
    case 'markdown':
      report = generateMarkdownReport(eventResults, goEmotionsResults);
      break;
    case 'json':
      report = JSON.stringify({ eventResults, goEmotionsResults }, null, 2);
      break;
    default:
      report = generateTextReport(eventResults, goEmotionsResults);
  }

  if (opts.output) {
    writeFileSync(resolve(opts.output), report);
    console.log(`Report written to: ${opts.output}`);
  } else {
    console.log(report);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
