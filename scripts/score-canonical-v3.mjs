/**
 * Score the v3 corpus (single-shot + narrative arcs) against the canonical
 * VibeScore formula. Emits results to results/canonical-v3-scored.json and
 * prints a pass/fail summary.
 *
 * Usage:  node scripts/score-canonical-v3.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateVibeScore, SCORE_MATH_VERSION } from "../lib/canonical-vibescore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/vibe-score-v3-corpus.json"), "utf8"));
const arcs   = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/vibe-score-v3-arcs.json"),   "utf8"));

const inRange = (s, [lo, hi]) => s >= lo && s <= hi;

const singleResults = corpus.cases.map((c) => {
  const read = calculateVibeScore(c.vector);
  const pass = inRange(read.score, c.expectedRange) &&
               (!c.expectedDominant || read.diagnostics.dominantEmotion === c.expectedDominant);
  return {
    domain: c.domain,
    name: c.name,
    score: read.score,
    expectedRange: c.expectedRange,
    dominant: read.diagnostics.dominantEmotion,
    expectedDominant: c.expectedDominant ?? null,
    pass,
    diagnostics: read.diagnostics,
  };
});

const arcResults = arcs.arcs.map((arc) => {
  const moments = arc.moments.map((m) => {
    const read = calculateVibeScore(m.vector);
    return {
      index: m.index,
      label: m.label,
      score: read.score,
      expectedRange: m.expectedRange,
      pass: inRange(read.score, m.expectedRange),
      diagnostics: read.diagnostics,
    };
  });
  const scores = moments.map((m) => m.score);
  const shapePass = (() => {
    const checks = [];
    if (arc.shape.peakAt !== undefined) {
      checks.push(scores[arc.shape.peakAt] === Math.max(...scores));
    }
    if (arc.shape.troughAt !== undefined) {
      checks.push(scores[arc.shape.troughAt] === Math.min(...scores));
    }
    if (arc.shape.risesFromStart && arc.shape.peakAt !== undefined) {
      checks.push(scores[0] < scores[arc.shape.peakAt]);
    }
    if (arc.shape.fallsFromPeak && arc.shape.peakAt !== undefined) {
      const last = scores.length - 1;
      if (last > arc.shape.peakAt) checks.push(scores[last] < scores[arc.shape.peakAt]);
    }
    return checks.every(Boolean);
  })();
  return {
    name: arc.name,
    shape: arc.shape,
    moments,
    shapePass,
    momentsPass: moments.every((m) => m.pass),
  };
});

const singleFails = singleResults.filter((r) => !r.pass);
const arcFails    = arcResults.filter((a) => !a.shapePass || !a.momentsPass);
const totalSingles = singleResults.length;
const totalArcs    = arcResults.length;
const totalMoments = arcResults.reduce((acc, a) => acc + a.moments.length, 0);

const out = {
  scoreMathVersion: SCORE_MATH_VERSION,
  ranAt: new Date().toISOString(),
  summary: {
    singleShot: { total: totalSingles, passed: totalSingles - singleFails.length, failed: singleFails.length },
    arcs:       { total: totalArcs,    passed: totalArcs    - arcFails.length,    failed: arcFails.length },
    moments:    { total: totalMoments },
  },
  singleShot: singleResults,
  arcs: arcResults,
};

const outPath = path.join(ROOT, "results/canonical-v3-scored.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

// ── Console summary ──
const tag = (pass) => (pass ? "PASS" : "FAIL");
console.log(`\nCanonical VibeScore ${SCORE_MATH_VERSION} — v3 corpus run`);
console.log("─".repeat(72));
const byDomain = {};
for (const r of singleResults) {
  byDomain[r.domain] ??= { p: 0, f: 0 };
  if (r.pass) byDomain[r.domain].p++; else byDomain[r.domain].f++;
}
for (const [d, { p, f }] of Object.entries(byDomain)) {
  console.log(`  ${d.padEnd(13)}  ${p}/${p+f} passed${f ? `  — ${f} failed` : ""}`);
}
console.log("─".repeat(72));
for (const a of arcResults) {
  const mp = a.moments.filter((m) => m.pass).length;
  const total = a.moments.length;
  console.log(`  arc  ${a.name.padEnd(40)}  ${mp}/${total} moments  shape: ${tag(a.shapePass)}`);
}
console.log("─".repeat(72));
console.log(`  TOTAL  single-shot ${totalSingles - singleFails.length}/${totalSingles} · arcs ${totalArcs - arcFails.length}/${totalArcs}`);
if (singleFails.length === 0 && arcFails.length === 0) {
  console.log("  ✅ all canonical fixtures pass\n");
} else {
  console.log("  ❌ failures listed in results/canonical-v3-scored.json\n");
  process.exit(1);
}
