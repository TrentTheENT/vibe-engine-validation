/**
 * Canonical VibeScore — vs-1.0-preview (vanilla JS port for the validation repo).
 *
 * Source of truth: Vibe-Score-Tungsten/lib/scoring/canonical-vibescore.ts.
 * Behavioral parity guaranteed by the regression suite in that repo
 * (95/95 passing as of 2026-05-20). If this file ever drifts from the
 * TS source, the canonical port-correctness gate will fail there first.
 *
 * Pipeline:
 *   1. Valence direction   — weighted sum / total magnitude → [-1, +1]
 *   2. Signal strength     — purity·0.6 + intensity·0.4, capped 1
 *   3. Valence-aware drag  — fires only on opposite-valence active pairs
 *   4. score = 500 + valence · signal · (1 − drag/100) · 500   (clipped [0,1000])
 */

export const SCORE_MATH_VERSION = "vs-1.0-preview";
export const CONFLICT_ACTIVATION_THRESHOLD = 0.15;
export const MAX_STDDEV_8D = 0.354;

export const VALENCE_WEIGHTS = {
  joy:          +1.0,
  trust:        +0.8,
  anticipation: +0.6,
  surprise:      0.0,   // resolved from neighbors at scoring time
  fear:         -0.7,
  anger:        -0.8,
  disgust:      -0.9,
  sadness:      -1.0,
};

const CONFLICT_PAIRS = [
  ["joy", "sadness"],
  ["trust", "disgust"],
  ["fear", "anger"],
  ["surprise", "anticipation"],
];

const EMOTIONS = [
  "joy", "trust", "anticipation", "surprise",
  "fear", "sadness", "disgust", "anger",
];

const DRAG_PER_CONFLICT = 25;
const MAX_DRAG = 100;
const PURITY_WEIGHT = 0.6;
const INTENSITY_WEIGHT = 0.4;

export function resolveSurpriseValence(v) {
  if ((v.surprise ?? 0) < 0.05) return 0;
  const pos = (v.joy ?? 0) + (v.trust ?? 0) + (v.anticipation ?? 0);
  const neg = (v.sadness ?? 0) + (v.anger ?? 0) + (v.disgust ?? 0) + (v.fear ?? 0);
  const total = pos + neg;
  if (total < 0.01) return 0;
  return (pos - neg) / total;
}

function dominantEmotionOf(v) {
  let best = "joy";
  let max = -Infinity;
  for (const e of EMOTIONS) {
    const val = v[e] ?? 0;
    if (val > max) {
      max = val;
      best = e;
    }
  }
  return best;
}

function trajectoryOf(drag) {
  if (drag >= 50) return "decaying";
  if (drag >= 20) return "wobble";
  return "stable";
}

export function calculateVibeScore(vIn) {
  // Normalize input to a complete 8-vector
  const v = {};
  for (const e of EMOTIONS) v[e] = vIn[e] ?? 0;

  const surpriseValence = resolveSurpriseValence(v);

  // 1. Valence direction
  let weightedSum = 0;
  let weightTotal = 0;
  for (const e of EMOTIONS) {
    const w = e === "surprise" ? surpriseValence : VALENCE_WEIGHTS[e];
    weightedSum += v[e] * w;
    weightTotal += Math.abs(v[e]);
  }
  const valence = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // 2. Signal strength
  const values = EMOTIONS.map((e) => v[e]);
  const intensity = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const purityRaw = Math.sqrt(variance) / MAX_STDDEV_8D;
  const signal = Math.min(1, purityRaw * PURITY_WEIGHT + intensity * INTENSITY_WEIGHT);

  // 3. Valence-aware drag
  let drag = 0;
  const activeConflicts = [];
  for (const [a, b] of CONFLICT_PAIRS) {
    if (v[a] > CONFLICT_ACTIVATION_THRESHOLD && v[b] > CONFLICT_ACTIVATION_THRESHOLD) {
      const wa = a === "surprise" ? surpriseValence : VALENCE_WEIGHTS[a];
      const wb = b === "surprise" ? surpriseValence : VALENCE_WEIGHTS[b];
      if (wa * wb < 0) {
        drag += DRAG_PER_CONFLICT;
        activeConflicts.push(`${a}<->${b}`);
      }
    }
  }
  drag = Math.min(MAX_DRAG, drag);
  const dragFactor = 1 - drag / MAX_DRAG;

  // 4. Final score
  const raw = 500 + valence * signal * dragFactor * 500;
  const score = Math.max(0, Math.min(1000, Math.round(raw)));

  return {
    score,
    scoreMathVersion: SCORE_MATH_VERSION,
    diagnostics: {
      valence: Number(valence.toFixed(4)),
      signal: Number(signal.toFixed(4)),
      drag,
      dragFactor: Number(dragFactor.toFixed(4)),
      intensity,
      purity: Number(Math.min(1, purityRaw).toFixed(4)),
      surpriseValence: Number(surpriseValence.toFixed(4)),
      activeConflicts,
      dominantEmotion: dominantEmotionOf(v),
      trajectory: trajectoryOf(drag),
    },
  };
}

export function scoreTier(score) {
  if (score >= 800) return "strongly_positive";
  if (score >= 600) return "positive";
  if (score >= 400) return "mixed_neutral";
  if (score >= 200) return "negative";
  return "strongly_negative";
}
